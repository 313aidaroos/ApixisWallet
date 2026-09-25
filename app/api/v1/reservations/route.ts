import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, callerMayUseApp } from "@/lib/api/service-auth";
import { ownerForCaller } from "@/lib/api/caller-owner";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { recordAudit, requestContext } from "@/lib/audit";
import { IDEMPOTENCY_KEY, productApp, reserveProduct } from "@/lib/api/reserve";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY),
  // owner_id = the Apixis ID `sub` (preferred). owner_email = pre-Apixis-ID path (verified email only).
  owner_email: z.string().email().max(320).optional(),
  owner_id: z.string().uuid().optional(),
}).refine((b) => b.owner_email || b.owner_id, { message: "owner_id or owner_email required" });

export async function POST(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reservation (productKey, idempotencyKey 8–80 printable chars, no spaces, owner_email)" }, { status: 400 });
  }

  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });
  const app = productApp(product);
  if (!callerMayUseApp(auth.caller, app)) {
    return NextResponse.json({ error: `This API key cannot redeem ${app} products` }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const owner = await ownerForCaller(
    supabase,
    auth.caller,
    { ownerId: parsed.data.owner_id, ownerEmail: parsed.data.owner_email },
    { create: true },
  );
  if ("error" in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });
  const ownerId = owner.ownerId;
  if (!ownerId) return NextResponse.json({ error: "owner_email required" }, { status: 400 });

  const { data, error } = await reserveProduct(supabase, {
    ownerId,
    product,
    idempotencyKey: parsed.data.idempotencyKey,
    actor: auth.caller.actor,
  });
  if (error) {
    await recordAudit(supabase, {
      event_type: "reserve",
      actor: auth.caller.actor,
      app_slug: app,
      owner_id: ownerId,
      owner_email: parsed.data.owner_email ?? null,
      product_key: product.key,
      amount_ixis: product.xp,
      outcome: "rejected",
      ...requestContext(request),
      details: { code: error.code ?? null, idempotency_key: parsed.data.idempotencyKey },
    });
    if (error.message?.includes("wallets_owner_id_fkey")) {
      return NextResponse.json({ error: "Unknown wallet owner — send owner_email, not a sister-site uid" }, { status: 400 });
    }
    return ledgerErrorResponse(error, "Reservation");
  }

  await recordAudit(supabase, {
    event_type: "reserve",
    dedupe_key: `reserve:${data}`,
    actor: auth.caller.actor,
    app_slug: app,
    owner_id: ownerId,
    owner_email: parsed.data.owner_email ?? null,
    ledger_transaction_id: data,
    reservation_id: data,
    product_key: product.key,
    amount_ixis: product.xp,
    ...requestContext(request),
    details: { idempotency_key: parsed.data.idempotencyKey, product_name: product.name, usd_equivalent: product.xp / 100 },
  });

  return NextResponse.json(
    {
      reservationId: data,
      status: "held",
      productKey: product.key,
      app,
      ixis: product.xp,
      xp: product.xp,
    },
    { status: 201 },
  );
}
