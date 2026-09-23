import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { IDEMPOTENCY_KEY, productApp, reserveProduct } from "@/lib/api/reserve";
import { sameOriginRequest } from "@/lib/api/origin";
import { recordAudit, requestContext } from "@/lib/audit";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  /** Generate once per click (crypto.randomUUID()) and reuse it on retry. */
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY),
});

/**
 * Redeem from inside the Wallet UI (Redeem / Shop tabs): signed-in user, session cookie only.
 * Wallet has nothing to provision itself, so it reserves and captures in one step; the capture
 * writes the entitlement that the sister app reads. Sister sites use /api/v1/reservations instead.
 */
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const userId = user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid redeem request" }, { status: 400 });
  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const held = await reserveProduct(supabase, {
    ownerId: userId,
    product,
    idempotencyKey: `wallet:${parsed.data.idempotencyKey}`,
    actor: "wallet-ui",
  });
  if (held.error) return ledgerErrorResponse(held.error, "Redeem");

  const captured = await supabase.rpc("capture_xp", {
    p_reservation_id: held.data,
    p_description: `${product.name} (${product.app})`,
    p_actor: "wallet-ui",
  });
  if (captured.error) {
    // Nothing was delivered, so give the Ixis back. A 409 here means it was already captured.
    await supabase.rpc("release_xp", { p_reservation_id: held.data, p_description: "Redeem failed", p_actor: "wallet-ui" });
    return ledgerErrorResponse(captured.error, "Redeem");
  }

  await recordAudit(supabase, {
    event_type: "redeem",
    dedupe_key: `redeem:${held.data}`,
    actor: "wallet-ui",
    app_slug: productApp(product),
    owner_id: userId,
    owner_email: user.email,
    ledger_transaction_id: captured.data,
    reservation_id: held.data,
    product_key: product.key,
    amount_ixis: product.xp,
    ...requestContext(request),
    details: { product_name: product.name, usd_equivalent: product.xp / 100, idempotency_key: parsed.data.idempotencyKey },
  });

  return NextResponse.json({
    status: "captured",
    reservationId: held.data,
    receiptId: captured.data,
    productKey: product.key,
    app: productApp(product),
    ixis: product.xp,
  });
}
