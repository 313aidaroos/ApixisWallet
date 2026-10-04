import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, callerMayUseApp } from "@/lib/api/service-auth";
import { ownerForCaller, ownerLinkAudit } from "@/lib/api/caller-owner";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { recordAudit, requestContext } from "@/lib/audit";
import { ledgerIdempotencyKey } from "@/lib/api/reserve";
import { LIMITS, checkLimits } from "@/lib/api/rate-limit";
import {
  DEFAULT_HOLD_DAYS, MAX_ORDER_IXIS, MIN_ORDER_IXIS, MIN_TIP_IXIS, MIN_WORLD_PURCHASE_IXIS, MIN_WORLD_TRADE_IXIS, ORDER_KINDS, WORLD_FEE_BPS,
  checkWorldOrder, holdSeconds, isWorldKind, marketplaceOrderSchema, minOrderIxis, orderDescription, recordOrderTerms, type OrderKind,
} from "@/lib/api/marketplace";
import { canonicalAppSlug } from "@/lib/checkout/destinations";

const bodySchema = marketplaceOrderSchema;

/**
 * Open a marketplace order: hold `amount` Ixis on the buyer until the seller delivers.
 * Settle with POST /api/v1/marketplace/orders/{reservationId}/settle; cancel with
 * POST /api/v1/reservations/{reservationId}/release. Idempotent per (app, idempotencyKey).
 *
 * World kinds (Apixis.dev in-world money, migration 014): `world_trade` pins `seller_id` now and
 * settle pays only them at the locked 5% fee; `world_purchase` settles to the platform (no payee).
 * Both need buyer_id (Apixis ID) and app `apixis`; their terms are recorded before the hold.
 */
export async function POST(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const limited = checkLimits([{ key: `client:${auth.caller.clientId ?? auth.caller.actor}`, ...LIMITS.clientReserve }]);
  if (limited) return limited;

  const raw = await request.json().catch(() => null);
  const rawKind = (raw as { kind?: unknown } | null)?.kind;
  const kind: OrderKind = (ORDER_KINDS as readonly unknown[]).includes(rawKind) ? (rawKind as OrderKind) : "order";
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Invalid order (amount ${MIN_ORDER_IXIS}–${MAX_ORDER_IXIS} Ixis, or ${MIN_TIP_IXIS}+ with kind "tip", ${MIN_WORLD_TRADE_IXIS}+ "world_trade", ${MIN_WORLD_PURCHASE_IXIS}+ "world_purchase"; whole Ixis; idempotencyKey 8–80 chars, buyer_id or buyer_email)`,
        code: "invalid_order",
        min_ixis: minOrderIxis(kind),
      },
      { status: 400 },
    );
  }

  const app = parsed.data.app ? canonicalAppSlug(parsed.data.app) : auth.caller.apps?.length === 1 ? auth.caller.apps[0] : null;
  if (!app) return NextResponse.json({ error: "app required (this key is scoped to several apps)" }, { status: 400 });
  if (!callerMayUseApp(auth.caller, app)) {
    return NextResponse.json({ error: `This API key cannot open ${app} orders` }, { status: 403 });
  }

  const world = checkWorldOrder({ kind: parsed.data.kind, app, buyerId: parsed.data.buyer_id, sellerId: parsed.data.seller_id });
  if (!world.ok) return NextResponse.json({ error: world.error, code: world.code }, { status: world.status });
  const worldKind = isWorldKind(parsed.data.kind) ? parsed.data.kind : null;

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const buyer = await ownerForCaller(
    supabase,
    auth.caller,
    { ownerId: parsed.data.buyer_id, ownerEmail: parsed.data.buyer_email },
    { create: true, marketplace: true },
  );
  if ("error" in buyer) return NextResponse.json({ error: buyer.error, ...(buyer.code ? { code: buyer.code } : {}) }, { status: buyer.status });
  const buyerId = buyer.ownerId;
  if (!buyerId) return NextResponse.json({ error: "buyer_email required" }, { status: 400 });

  const ownerLimit = checkLimits([{ key: `owner:${buyerId}`, ...LIMITS.ownerReserve }]);
  if (ownerLimit) return ownerLimit;

  // world_trade: the counterparty must be a linked Apixis ID too (same PR #40 rule), checked now so a
  // proposal to an unknown agent fails before any Ixis is held.
  let seller: Awaited<ReturnType<typeof ownerForCaller>> | null = null;
  if (worldKind === "world_trade") {
    seller = await ownerForCaller(supabase, auth.caller, { ownerId: parsed.data.seller_id }, { create: false, marketplace: true });
    if ("error" in seller) return NextResponse.json({ error: seller.error, ...(seller.code ? { code: seller.code } : {}) }, { status: seller.status });
  }
  const externalId = ledgerIdempotencyKey(app, parsed.data.idempotencyKey);
  if (worldKind) {
    const terms = await recordOrderTerms(supabase, {
      external_id: externalId,
      kind: worldKind,
      app_slug: app,
      buyer_id: buyerId,
      seller_id: worldKind === "world_trade" ? (parsed.data.seller_id as string) : null,
      fee_bps: WORLD_FEE_BPS,
      reference: parsed.data.reference ?? null,
      actor: auth.caller.actor,
    });
    if (!terms.ok) return NextResponse.json({ error: terms.error, code: terms.code }, { status: terms.status });
  }

  const defaultLabel = worldKind === "world_trade" ? "World trade" : worldKind === "world_purchase" ? "World purchase" : undefined;
  const description = orderDescription(app, parsed.data.reference, parsed.data.description ?? defaultLabel);
  const { data, error } = await supabase.rpc("reserve_xp", {
    p_owner_id: buyerId,
    p_amount: parsed.data.amount,
    p_description: description,
    p_external_id: externalId,
    p_app_slug: app,
    p_product_key: null,
    p_actor: auth.caller.actor,
    p_entitlement_days: null,
    p_hold_seconds: holdSeconds(parsed.data.holdDays ?? DEFAULT_HOLD_DAYS),
  });

  await recordAudit(supabase, {
    event_type: "reserve",
    dedupe_key: error ? null : `reserve:${data}`,
    actor: auth.caller.actor,
    app_slug: app,
    owner_id: buyerId,
    owner_email: parsed.data.buyer_email ?? null,
    ledger_transaction_id: error ? null : data,
    reservation_id: error ? null : data,
    product_key: null,
    amount_ixis: parsed.data.amount,
    outcome: error ? "rejected" : "ok",
    ...requestContext(request),
    details: {
      marketplace: true,
      kind: parsed.data.kind ?? "order",
      reference: parsed.data.reference ?? null,
      idempotency_key: parsed.data.idempotencyKey,
      hold_days: parsed.data.holdDays ?? DEFAULT_HOLD_DAYS,
      ...ownerLinkAudit(buyer, "buyer"),
      ...(worldKind ? { world: true, fee_bps: WORLD_FEE_BPS, seller_id: parsed.data.seller_id ?? null, ...(seller ? ownerLinkAudit(seller, "seller") : {}) } : {}),
      ...(error ? { code: error.code ?? null } : { usd_equivalent: parsed.data.amount / 100 }),
    },
  });
  if (error) {
    if (error.message?.includes("wallets_owner_id_fkey")) {
      return NextResponse.json({ error: "Unknown wallet owner — send buyer_email, not a sister-site uid" }, { status: 400 });
    }
    return ledgerErrorResponse(error, "Order");
  }

  return NextResponse.json(
    {
      reservationId: data, status: "held", app, ixis: parsed.data.amount,
      ...(worldKind ? { kind: worldKind, sellerId: parsed.data.seller_id ?? null, feeBps: WORLD_FEE_BPS } : {}),
    },
    { status: 201 },
  );
}
