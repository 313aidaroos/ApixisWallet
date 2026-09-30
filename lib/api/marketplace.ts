/**
 * Marketplace settlement: a person pays another person through the one ledger.
 *
 * Catalog redeems move Ixis from a customer to the family (capture → clearing). A marketplace order
 * (Ominix job, a future Rawixis deal) moves Ixis from a buyer to a seller with the Apixis Bank fee
 * kept back (D12: 5% = 500 bps everywhere). It reuses the hold machinery unchanged:
 *
 *   order  = reserve_xp on the buyer (arbitrary amount, no product key → no entitlement row)
 *   settle = capture_xp on that hold (buyer → clearing), then credit_xp on the seller for
 *            amount − fee. The fee is whatever stays in clearing. Both steps are idempotent by
 *            external id, so a retried settle after a lost response never pays twice.
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

export type Split = { amount: number; fee: number; payout: number; feeBps: number };

/** Fee rounds down (the seller never loses a whole Ixis to rounding); payout = amount − fee. */
export function marketplaceSplit(amount: number, feeBps: number = DEFAULT_FEE_BPS): Split {
  if (!Number.isInteger(amount) || amount < MIN_ORDER_IXIS || amount > MAX_ORDER_IXIS) {
    throw new RangeError(`amount must be an integer between ${MIN_ORDER_IXIS} and ${MAX_ORDER_IXIS} Ixis`);
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
