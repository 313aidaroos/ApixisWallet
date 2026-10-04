import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { IDEMPOTENCY_KEY } from "@/lib/api/reserve";

/**
 * Marketplace settlement: a person pays another person through the one ledger.
 *
 * Catalog redeems move Ixis from a customer to the family (capture → clearing). A marketplace order
 * (Ominix job, a future Rawixis deal) moves Ixis from a buyer to a seller with the Apixis Bank fee
 * kept back (D12: 5% = 500 bps everywhere). It reuses the hold machinery unchanged:
 *
 *   order  = reserve_xp on the buyer (arbitrary amount, no product key → no entitlement row)
 *   settle = capture_xp on that hold (buyer → clearing), then settle_marketplace_payout on the
 *            seller for amount − fee (migration 013; was credit_xp 'paid'). The fee is whatever
 *            stays in clearing. Both steps are idempotent by external id, so a retried settle
 *            after a lost response never pays twice.
 *
 * Bonus stays bonus (2026-10-04, hub decision under Awad's locks): free Ixis (the welcome grant,
 * promos) must never turn into paid Ixis through a sale. The payout is split in the ratio the
 * buyer's hold was funded — see payoutSplit / PAYOUT_RULE.
 *   cancel = the ordinary /api/v1/reservations/{id}/release.
 */

export const DEFAULT_FEE_BPS = 500;
export const MAX_FEE_BPS = 5000;
/** Orders may stay held for up to 30 days (delivery windows), unlike the 30-minute redeem hold. Needs migration 011. */
export const MAX_HOLD_DAYS = 30;
export const DEFAULT_HOLD_DAYS = 14;
/** Smallest order: 100 Ixis ($1). Keeps dust and fee rounding to zero out of the ledger. */
export const MIN_ORDER_IXIS = 100;
export const MAX_ORDER_IXIS = 10_000_000;

/**
 * Order kinds (2026-10-04, Grok, for the shared feed on apixis.dev). `order` (default) is every
 * existing order: minimum MIN_ORDER_IXIS, unchanged. `tip` is a person → creator tip, so the feed's
 * 10 / 50 Ixis preset buttons work: minimum MIN_TIP_IXIS. Same hold, settle, fee and rounding as any
 * order. Note: with the 5% fee rounded down, a 10–19 Ixis tip carries a 0 fee (creator gets it all).
 */
export const ORDER_KINDS = ["order", "tip"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];
export const MIN_TIP_IXIS = 10;

export function minOrderIxis(kind: OrderKind = "order") {
  return kind === "tip" ? MIN_TIP_IXIS : MIN_ORDER_IXIS;
}

export type Split = { amount: number; fee: number; payout: number; feeBps: number };

/**
 * Fee rounds down (the seller never loses a whole Ixis to rounding); payout = amount − fee.
 * Integer-only: fee + payout always equals amount, so settle neither creates nor loses Ixis.
 * Settle splits an existing hold, which was already checked against its kind's minimum when the
 * order was opened, so the floor here is the smallest any kind allows (MIN_TIP_IXIS).
 */
export function marketplaceSplit(amount: number, feeBps: number = DEFAULT_FEE_BPS): Split {
  if (!Number.isInteger(amount) || amount < MIN_TIP_IXIS || amount > MAX_ORDER_IXIS) {
    throw new RangeError(`amount must be an integer between ${MIN_TIP_IXIS} and ${MAX_ORDER_IXIS} Ixis`);
  }
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new RangeError(`feeBps must be an integer between 0 and ${MAX_FEE_BPS}`);
  }
  const fee = Math.floor((amount * feeBps) / 10_000);
  return { amount, fee, payout: amount - fee, feeBps };
}

export function holdSeconds(holdDays: number = DEFAULT_HOLD_DAYS) {
  const days = Math.min(MAX_HOLD_DAYS, Math.max(1, Math.floor(holdDays)));
  return days * 86_400;
}

/** Product-less holds are labelled by app so the ledger and audit still say what they were for. */
export function orderDescription(app: string, reference: string | undefined, description: string | undefined) {
  const label = description?.trim() || "Marketplace order";
  return reference ? `${label} · ${app} ${reference}` : `${label} · ${app}`;
}

/** Body of POST /api/v1/marketplace/orders. */
export const marketplaceOrderSchema = z
  .object({
    /** Which family app the order belongs to. Optional when the key is scoped to exactly one app. */
    app: z.string().min(1).max(40).optional(),
    /** `order` (default, min 100 Ixis) or `tip` (min 10 Ixis, for feed tips). Same hold, settle and fee. */
    kind: z.enum(ORDER_KINDS).optional(),
    amount: z.number().int().min(MIN_TIP_IXIS).max(MAX_ORDER_IXIS),
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY),
    /** Your order / job id, for the ledger description and the audit trail. */
    reference: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(120).optional(),
    holdDays: z.number().int().min(1).max(MAX_HOLD_DAYS).optional(),
    // The buyer: Apixis ID `sub` (preferred) or verified email (legacy).
    buyer_id: z.string().uuid().optional(),
    buyer_email: z.string().email().max(320).optional(),
  })
  .refine((b) => b.buyer_id || b.buyer_email, { message: "buyer_id or buyer_email required" })
  .refine((b) => b.amount >= minOrderIxis(b.kind ?? "order"), { message: "amount below the minimum for this kind" });

/** Documented in audit rows, so a reader can tell which rule produced a payout. */
export const PAYOUT_RULE = "proportional_paid_floor_v1";

export type PayoutSplit = { paid: number; bonus: number };

/**
 * TS mirror of settle_marketplace_payout (013), used by tests and docs. The hold was funded
 * heldPaid + heldBonus (bonus first at reserve time). The seller gets
 *   paid  = floor(payout × heldPaid / (heldPaid + heldBonus))
 *   bonus = payout − paid
 * so paid ≤ heldPaid always: a settle never creates paid Ixis out of free Ixis. The rounding
 * remainder (under 1 Ixis) lands in bonus. All-paid holds pay all paid (unchanged behaviour).
 */
export function payoutSplit(payout: number, heldPaid: number, heldBonus: number): PayoutSplit {
  const total = heldPaid + heldBonus;
  if (![payout, heldPaid, heldBonus].every(Number.isSafeInteger) || payout <= 0 || heldPaid < 0 || heldBonus < 0 || total <= 0 || payout > total) {
    throw new RangeError("payout must be a positive integer no larger than the hold; hold parts non-negative integers");
  }
  const paid = Math.floor((payout * heldPaid) / total);
  return { paid, bonus: payout - paid };
}

type PayoutArgs = {
  reservationId: string;
  sellerId: string;
  payout: number;
  description: string;
  externalId: string;
  app: string;
  actor: string;
};

export type PayoutResult = { transactionId: string; paid: number; bonus: number } | { error: string };

const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/**
 * Seller payout for a captured hold. Uses settle_marketplace_payout (013). If that function isn't
 * deployed yet (the few minutes between this deploy and the migration), an all-paid hold falls
 * back to the old credit_xp 'paid' path under the same idempotency key; a hold with ANY bonus in it
 * stays `payout_pending` (retryable) rather than paying free Ixis out as paid.
 */
export async function settlePayout(supabase: SupabaseClient, args: PayoutArgs): Promise<PayoutResult> {
  const rpc = await supabase.rpc("settle_marketplace_payout", {
    p_reservation_id: args.reservationId,
    p_seller_id: args.sellerId,
    p_payout: args.payout,
    p_description: args.description,
    p_external_id: args.externalId,
    p_app_slug: args.app,
    p_actor: args.actor,
  });
  if (!rpc.error) {
    const data = (rpc.data ?? {}) as { transaction_id?: string; paid?: number | string; bonus?: number | string };
    if (!data.transaction_id) return { error: "no_transaction" };
    return { transactionId: data.transaction_id, paid: Number(data.paid ?? 0), bonus: Number(data.bonus ?? 0) };
  }
  if (!MISSING_FUNCTION.has(rpc.error.code ?? "")) return { error: rpc.error.code ?? "rpc_failed" };

  const funding = await supabase.from("ledger_entries").select("bucket, amount").eq("transaction_id", args.reservationId).in("bucket", ["paid", "bonus"]);
  if (funding.error) return { error: "funding_lookup_failed" };
  const heldBonus = (funding.data ?? []).filter((row) => row.bucket === "bonus").reduce((sum, row) => sum - Number(row.amount), 0);
  if (heldBonus !== 0) return { error: "bonus_payout_needs_migration_013" };

  const legacy = await supabase.rpc("credit_xp", {
    p_owner_id: args.sellerId,
    p_amount: args.payout,
    p_bucket: "paid",
    p_description: args.description,
    p_external_id: args.externalId,
    p_app_slug: args.app,
    p_expires_at: null,
  });
  if (legacy.error) return { error: legacy.error.code ?? "credit_failed" };
  return { transactionId: legacy.data as string, paid: args.payout, bonus: 0 };
}
