/**
 * Browser helpers for the Wallet UI (client components). Data only — no styling, no state.
 * Every call uses the signed-in session cookie. A 401 means "send them to /login?next=…".
 *
 *   const balance = await fetchBalance();          // { available, paid, bonus, reserved, usd }
 *   const page = await fetchHistory({ limit: 20 }); // receipts, newest first
 *   const result = await redeemProduct("renoxis.agent.monthly");
 */

export type Balance = {
  currency: "Ixis";
  available: number;
  paid: number;
  bonus: number;
  reserved: number;
  usd: number;
  rate: { ixisPerDollar: number };
};

export type HistoryItem = {
  id: string;
  kind: "purchase" | "bonus" | "reserve" | "spend" | "release" | "refund" | "adjustment" | string;
  description: string;
  app: string | null;
  productKey: string | null;
  /** Change to spendable Ixis. */
  amount: number;
  /** Change to held Ixis. */
  held: number;
  createdAt: string;
};

export type History = { transactions: HistoryItem[]; total: number; limit: number; offset: number };

export type RedeemResult =
  | { ok: true; receiptId: string; productKey: string; app: string; ixis: number }
  | { ok: false; reason: "signin" | "insufficient" | "unknown_product" | "error"; message: string };

export class WalletClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  get needsSignIn() {
    return this.status === 401;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new WalletClientError(response.status, (data && typeof data.error === "string" && data.error) || `Wallet ${response.status}`);
  return data as T;
}

export function fetchBalance() {
  return getJson<Balance>("/api/v1/wallet");
}

export function fetchHistory(options: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 50), offset: String(options.offset ?? 0) });
  return getJson<History>(`/api/v1/ledger?${params}`);
}

/**
 * Spend Ixis on a catalog SKU from inside the Wallet. Pass the same `idempotencyKey` when retrying
 * the same click so a double-click or retry never charges twice.
 */
export async function redeemProduct(productKey: string, idempotencyKey: string = crypto.randomUUID()): Promise<RedeemResult> {
  const response = await fetch("/api/v1/redeem", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productKey, idempotencyKey }),
  });
  const data = await response.json().catch(() => null);
  const message = (data && typeof data.error === "string" && data.error) || `Wallet ${response.status}`;
  if (response.ok) return { ok: true, receiptId: data.receiptId, productKey: data.productKey, app: data.app, ixis: data.ixis };
  if (response.status === 401) return { ok: false, reason: "signin", message };
  if (response.status === 402) return { ok: false, reason: "insufficient", message };
  if (response.status === 404) return { ok: false, reason: "unknown_product", message };
  return { ok: false, reason: "error", message };
}
