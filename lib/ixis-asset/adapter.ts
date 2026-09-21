import { getIxisAssetMode } from "@/lib/ixis-asset/mode";
import { assertWithinMintCap } from "@/lib/ixis-asset/supply";

/**
 * Chain projection of the Wallet ledger.
 * Supply is liability-backed: a mint cites the recognized outstanding liability
 * and must stay within IXIS_MAX_SUPPLY. This module does not pre-mint the cap.
 * Demo mint and burn do nothing. Live throws until a chain client exists.
 * Chain RPC or signer secrets do not enable a transfer. This module does not
 * withdraw, cash out, or publish a price.
 */

export type ChainMovement = {
  ownerId: string;
  amount: number;
  reason: string;
};

export type MintMovement = ChainMovement & {
  /** Recognized liability-backed supply before this mint. Not the cap. */
  outstandingLiability: number;
};

export type ChainNoop = { applied: false; mode: "demo" };

export async function mintIxis(movement: MintMovement): Promise<ChainNoop> {
  assertWithinMintCap(movement.outstandingLiability, movement.amount);
  if (getIxisAssetMode() !== "live") return { applied: false, mode: "demo" };
  throw new Error("not configured");
}

export async function burnIxis(movement: ChainMovement): Promise<ChainNoop> {
  if (!Number.isSafeInteger(movement.amount) || movement.amount <= 0) {
    throw new Error("Chain amount must be positive");
  }
  if (getIxisAssetMode() !== "live") return { applied: false, mode: "demo" };
  throw new Error("not configured");
}
