import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDestination } from "@/lib/checkout/destinations";
import { canonicalReturnUrl, type AllowOptions } from "@/lib/checkout/return-url";
import { packPurchaseDescription } from "@/lib/stripe/fulfillment";

export type CheckoutStatusPayload = {
  status: "pending" | "credited" | "expired";
  /** redirect: allowlisted return_url after credit. choose: Wallet vs sister app. wait: ledger not ready. */
  next: "wait" | "redirect" | "choose";
  pack: { id: string; name: string; ixis: number } | null;
  destinationApp: string | null;
  destinationLabel: string | null;
  /** Full URL only when next is redirect. The browser return hop uses /api/checkout/return. */
  returnUrl: string | null;
  returnHost: string | null;
  ledgerUnreachable: boolean;
};

export function buildStatusPayload(
  input: {
    sessionStatus: string | null;
    paymentStatus: string | null;
    credited: boolean;
    ledgerUnreachable: boolean;
    pack: { id: string; name: string; xp: number } | null;
    returnUrl: string | null;
    destinationApp: string | null;
  },
  options?: AllowOptions,
): CheckoutStatusPayload {
  const destination = input.destinationApp ? resolveDestination(input.destinationApp) : null;
  const returnUrl = input.returnUrl ? canonicalReturnUrl(input.returnUrl, options) : null;
  const returnHost = returnUrl ? new URL(returnUrl).host : null;
  const pack = input.pack ? { id: input.pack.id, name: input.pack.name, ixis: input.pack.xp } : null;
  const base = {
    pack,
    destinationApp: destination?.slug ?? null,
    destinationLabel: destination?.label ?? null,
    returnHost,
    ledgerUnreachable: input.ledgerUnreachable,
  };

  if (input.credited && pack) {
    return {
      ...base,
      status: "credited",
      next: returnUrl ? "redirect" : "choose",
      returnUrl,
      ledgerUnreachable: false,
    };
  }

  if (input.sessionStatus === "expired" && input.paymentStatus !== "paid") {
    return { ...base, status: "expired", next: "wait", returnUrl: null };
  }

  return { ...base, status: "pending", next: "wait", returnUrl: null };
}

/** Strip the external URL before it reaches the browser. Redirects go through our route. */
export function toPublicStatus(payload: CheckoutStatusPayload) {
  return {
    status: payload.status,
    next: payload.next,
    pack: payload.pack,
    destinationApp: payload.destinationApp,
    destinationLabel: payload.destinationLabel,
    returnHost: payload.returnHost,
    ledgerUnreachable: payload.ledgerUnreachable,
  };
}

export function returnRedirectTarget(payload: CheckoutStatusPayload, options?: AllowOptions) {
  if (payload.next !== "redirect" || !payload.returnUrl) return null;
  return canonicalReturnUrl(payload.returnUrl, options);
}

/**
 * True when this Checkout Session's pack has a paid ledger credit created after the session.
 * Matches credit_xp's description. Idempotency stays on the Stripe event id in the webhook.
 */
export async function findPaidPackCredit(
  supabase: SupabaseClient,
  input: { ownerId: string; amount: number; packName: string; since: Date },
) {
  const sinceIso = input.since.toISOString();
  const description = packPurchaseDescription(input.packName);

  const wallet = await supabase.from("wallets").select("id").eq("owner_id", input.ownerId).eq("currency", "XP").limit(1);
  if (wallet.error) throw wallet.error;
  const walletId = wallet.data?.[0]?.id;
  if (!walletId) return null;

  const txs = await supabase
    .from("ledger_transactions")
    .select("id")
    .eq("kind", "purchase")
    .eq("description", description)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  if (txs.error) throw txs.error;
  const ids = (txs.data ?? []).map((row) => row.id).filter((id): id is string => Boolean(id));
  if (!ids.length) return null;

  const entries = await supabase
    .from("ledger_entries")
    .select("transaction_id")
    .eq("wallet_id", walletId)
    .eq("bucket", "paid")
    .eq("amount", input.amount)
    .in("transaction_id", ids)
    .limit(1);
  if (entries.error) throw entries.error;
  return entries.data?.[0]?.transaction_id ?? null;
}
