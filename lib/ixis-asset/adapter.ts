import { getIxisAssetMode } from "@/lib/ixis-asset/mode";

/**
 * Chain projection of the Wallet ledger.
 * Demo mint and burn do nothing. Live throws until a chain client exists.
 * Chain RPC or signer secrets do not enable a transfer. This module does not
 * withdraw, cash out, or publish a price.
 */

export type ChainMovement = {
  ownerId: string;
  amount: number;
  reason: string;
};

export type ChainNoop = { applied: false; mode: "demo" };

export async function mintIxis(movement: ChainMovement): Promise<ChainNoop> {
  if (movement.amount <= 0) throw new Error("Chain amount must be positive");
  if (getIxisAssetMode() !== "live") return { applied: false, mode: "demo" };
  throw new Error("not configured");
}

export async function burnIxis(movement: ChainMovement): Promise<ChainNoop> {
  if (movement.amount <= 0) throw new Error("Chain amount must be positive");
  if (getIxisAssetMode() !== "live") return { applied: false, mode: "demo" };
  throw new Error("not configured");
}
