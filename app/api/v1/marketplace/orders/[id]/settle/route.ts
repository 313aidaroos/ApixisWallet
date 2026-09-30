import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService } from "@/lib/api/service-auth";
import { ownerForCaller } from "@/lib/api/caller-owner";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { recordAudit, requestContext } from "@/lib/audit";
import { DEFAULT_FEE_BPS, MAX_FEE_BPS, marketplaceSplit } from "@/lib/api/marketplace";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z
  .object({
    seller_id: z.string().uuid().optional(),
    seller_email: z.string().email().max(320).optional(),
    /** Apixis Bank fee in basis points. Family default 500 (5%, D12). */
    feeBps: z.number().int().min(0).max(MAX_FEE_BPS).optional(),
    description: z.string().min(1).max(120).optional(),
  })
  .refine((b) => b.seller_id || b.seller_email, { message: "seller_id or seller_email required" });

/**
 * Settle a marketplace order: capture the buyer's hold, pay the seller `amount − fee`.
 * Idempotent: a retry after a lost response returns the same receipt and never pays twice.
 * If the capture succeeded but the payout failed, the response says `captured: true` — retry
 * the same call; the buyer is already charged and the payout is keyed to this order.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Order not found", code: "not_found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settle request (seller_id or seller_email, feeBps 0–5000)" }, { status: 400 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  // The hold: app-scoped like capture, so one site's key cannot settle another site's orders.
  const hold = await supabase
    .from("ledger_transactions")
    .select("id, app_slug, external_id, product_key")
    .eq("id", id)
    .eq("kind", "reserve")
    .maybeSingle();
  if (hold.error) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const app = hold.data?.app_slug as string | null | undefined;
  if (!hold.data || hold.data.product_key !== null || !app || (auth.caller.apps !== null && !auth.caller.apps.includes(app))) {
    return NextResponse.json({ error: "Order not found", code: "not_found" }, { status: 404 });
  }

  const reserved = await supabase.from("ledger_entries").select("amount").eq("transaction_id", id).eq("bucket", "reserved");
  if (reserved.error) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const amount = (reserved.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  if (amount <= 0) return NextResponse.json({ error: "Order not found", code: "not_found" }, { status: 404 });

  // Sellers are people who have a Wallet through this site; reads never create accounts.
  const seller = await ownerForCaller(
    supabase,
    auth.caller,
    { ownerId: parsed.data.seller_id, ownerEmail: parsed.data.seller_email },
    { create: true },
  );
  if ("error" in seller) return NextResponse.json({ error: seller.error }, { status: seller.status });
  const sellerId = seller.ownerId;
  if (!sellerId) return NextResponse.json({ error: "seller_email required" }, { status: 400 });

  const split = marketplaceSplit(amount, parsed.data.feeBps ?? DEFAULT_FEE_BPS);
  const description = parsed.data.description?.trim() || "Marketplace order settled";

  const captured = await supabase.rpc("capture_xp", {
    p_reservation_id: id,
    p_description: description,
    p_actor: auth.caller.actor,
    p_allowed_apps: auth.caller.apps,
  });
  await recordAudit(supabase, {
    event_type: "capture",
    dedupe_key: captured.error ? null : `capture:${id}`,
    actor: auth.caller.actor,
    app_slug: app,
    reservation_id: id,
    ledger_transaction_id: captured.error ? null : captured.data,
    amount_ixis: amount,
    outcome: captured.error ? "rejected" : "ok",
    ...requestContext(request),
    details: captured.error ? { code: captured.error.code ?? null, marketplace: true } : { marketplace: true, fee_bps: split.feeBps, fee_ixis: split.fee, payout_ixis: split.payout },
  });
  if (captured.error) return ledgerErrorResponse(captured.error, "Settle");

  let payoutTx: string | null = null;
  if (split.payout > 0) {
    const payout = await supabase.rpc("credit_xp", {
      p_owner_id: sellerId,
      p_amount: split.payout,
      p_bucket: "paid",
      p_description: `${description} · payout`,
      p_external_id: `${hold.data.external_id}:payout`,
      p_app_slug: app,
      p_expires_at: null,
    });
    if (payout.error) {
      console.error("marketplace payout failed", { code: payout.error.code, reservation: id });
      return NextResponse.json(
        { error: "Buyer charged, seller payout pending — retry this settle", code: "payout_pending", captured: true, receiptId: captured.data },
        { status: 500 },
      );
    }
    payoutTx = payout.data as string;
    await recordAudit(supabase, {
      event_type: "payout",
      dedupe_key: `payout:${id}`,
      actor: auth.caller.actor,
      app_slug: app,
      owner_id: sellerId,
      owner_email: parsed.data.seller_email ?? null,
      reservation_id: id,
      ledger_transaction_id: payoutTx,
      amount_ixis: split.payout,
      ...requestContext(request),
      details: { marketplace: true, payout_for: captured.data, fee_bps: split.feeBps, fee_ixis: split.fee },
    });
  }

  return NextResponse.json({
    reservationId: id,
    status: "settled",
    receiptId: captured.data,
    payoutId: payoutTx,
    app,
    ixis: split.amount,
    fee: split.fee,
    feeBps: split.feeBps,
    payout: split.payout,
  });
}
