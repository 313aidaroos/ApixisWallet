import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, callerMayUseApp } from "@/lib/api/service-auth";
import { ownerForCaller } from "@/lib/api/caller-owner";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { recordAudit, requestContext } from "@/lib/audit";
import { IDEMPOTENCY_KEY, ledgerIdempotencyKey } from "@/lib/api/reserve";
import { LIMITS, checkLimits } from "@/lib/api/rate-limit";
import { DEFAULT_HOLD_DAYS, MAX_HOLD_DAYS, MAX_ORDER_IXIS, MIN_ORDER_IXIS, holdSeconds, orderDescription } from "@/lib/api/marketplace";
import { canonicalAppSlug } from "@/lib/checkout/destinations";

const bodySchema = z
  .object({
    /** Which family app the order belongs to. Optional when the key is scoped to exactly one app. */
    app: z.string().min(1).max(40).optional(),
    amount: z.number().int().min(MIN_ORDER_IXIS).max(MAX_ORDER_IXIS),
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY),
    /** Your order / job id, for the ledger description and the audit trail. */
    reference: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(120).optional(),
    holdDays: z.number().int().min(1).max(MAX_HOLD_DAYS).optional(),
    // The buyer: Apixis ID `sub` (preferred) or verified email (legacy).
    buyer_id: z.string().uuid().optional(),
    buyer_email: z.string().email().max(320).optional(),
  })
  .refine((b) => b.buyer_id || b.buyer_email, { message: "buyer_id or buyer_email required" });

/**
 * Open a marketplace order: hold `amount` Ixis on the buyer until the seller delivers.
 * Settle with POST /api/v1/marketplace/orders/{reservationId}/settle; cancel with
 * POST /api/v1/reservations/{reservationId}/release. Idempotent per (app, idempotencyKey).
 */
export async function POST(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const limited = checkLimits([{ key: `client:${auth.caller.clientId ?? auth.caller.actor}`, ...LIMITS.clientReserve }]);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid order (amount ${MIN_ORDER_IXIS}–${MAX_ORDER_IXIS} Ixis, idempotencyKey 8–80 chars, buyer_id or buyer_email)` },
      { status: 400 },
    );
  }

  const app = parsed.data.app ? canonicalAppSlug(parsed.data.app) : auth.caller.apps?.length === 1 ? auth.caller.apps[0] : null;
  if (!app) return NextResponse.json({ error: "app required (this key is scoped to several apps)" }, { status: 400 });
  if (!callerMayUseApp(auth.caller, app)) {
    return NextResponse.json({ error: `This API key cannot open ${app} orders` }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const buyer = await ownerForCaller(
    supabase,
    auth.caller,
    { ownerId: parsed.data.buyer_id, ownerEmail: parsed.data.buyer_email },
    { create: true },
  );
  if ("error" in buyer) return NextResponse.json({ error: buyer.error }, { status: buyer.status });
  const buyerId = buyer.ownerId;
  if (!buyerId) return NextResponse.json({ error: "buyer_email required" }, { status: 400 });

  const ownerLimit = checkLimits([{ key: `owner:${buyerId}`, ...LIMITS.ownerReserve }]);
  if (ownerLimit) return ownerLimit;

  const description = orderDescription(app, parsed.data.reference, parsed.data.description);
  const { data, error } = await supabase.rpc("reserve_xp", {
    p_owner_id: buyerId,
    p_amount: parsed.data.amount,
    p_description: description,
    p_external_id: ledgerIdempotencyKey(app, parsed.data.idempotencyKey),
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
      reference: parsed.data.reference ?? null,
      idempotency_key: parsed.data.idempotencyKey,
      hold_days: parsed.data.holdDays ?? DEFAULT_HOLD_DAYS,
      ...(error ? { code: error.code ?? null } : { usd_equivalent: parsed.data.amount / 100 }),
    },
  });
  if (error) {
    if (error.message?.includes("wallets_owner_id_fkey")) {
      return NextResponse.json({ error: "Unknown wallet owner — send buyer_email, not a sister-site uid" }, { status: 400 });
    }
    return ledgerErrorResponse(error, "Order");
  }

  return NextResponse.json({ reservationId: data, status: "held", app, ixis: parsed.data.amount }, { status: 201 });
}
