/**
 * Hard mint ceiling. 1 trillion Ixis = $10B at the 100 Ixis = $1 peg.
 * This is a ceiling on liability-backed supply, not an opening balance.
 * Nothing in this module mints the cap, airdrops it, or treats it as circulating.
 */

export const IXIS_MAX_SUPPLY = 1_000_000_000_000;

/** Purchasing-power peg inside the family. */
export const IXIS_PEG_PER_DOLLAR = 100;

/** Dollar value of the hard cap at the peg: $10,000,000,000. */
export const IXIS_MAX_SUPPLY_USD = IXIS_MAX_SUPPLY / IXIS_PEG_PER_DOLLAR;

function assertLiability(currentLiability: number) {
  if (!Number.isSafeInteger(currentLiability) || currentLiability < 0) {
    throw new Error("Outstanding liability must be a non-negative integer");
  }
  if (currentLiability > IXIS_MAX_SUPPLY) {
    throw new Error("Outstanding liability exceeds IXIS_MAX_SUPPLY");
  }
}

/** Headroom under the cap. Zero when the recognized liability already fills it. */
export function remainingMintable(currentLiability: number): number {
  assertLiability(currentLiability);
  return IXIS_MAX_SUPPLY - currentLiability;
}

/**
 * Reject a mint that is not a positive integer or that would push
 * recognized liability above IXIS_MAX_SUPPLY. Does not mint.
 */
export function assertWithinMintCap(currentLiability: number, amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Mint amount must be a positive integer");
  }
  assertLiability(currentLiability);
  if (amount > remainingMintable(currentLiability)) {
    throw new Error("Mint would exceed IXIS_MAX_SUPPLY");
  }
}
