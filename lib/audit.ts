import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Legal record (public.audit_events, migration 008). Append-only, service_role only.
 * The ledger is the accounting truth; this is the evidence around it: who, when, which site,
 * IP / user agent, what was shown, and every Stripe id. See AGENTS.md → Records.
 */
export type AuditEventType =
  | "checkout_started"
  | "purchase"
  | "refund"
  | "dispute_lost"
  | "reserve"
  | "capture"
  | "release"
  | "redeem"
  | "hold_expiry_sweep";

export type AuditEvent = {
  event_type: AuditEventType;
  /** Makes the write idempotent, e.g. `purchase:evt_123`. Same key twice = one row. */
  dedupe_key?: string | null;
  actor?: string | null;
  app_slug?: string | null;
  owner_id?: string | null;
  owner_email?: string | null;
  ledger_transaction_id?: string | null;
  reservation_id?: string | null;
  product_key?: string | null;
  amount_ixis?: number | null;
  amount_cents?: number | null;
  currency?: string | null;
  stripe_event_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_invoice_id?: string | null;
  stripe_receipt_url?: string | null;
  terms_version?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  outcome?: "ok" | "rejected" | "failed";
  details?: Record<string, unknown>;
};

/** Terms the customer agreed to at checkout. Bump TERMS_VERSION whenever the terms page changes. */
export function termsVersion() {
  return (process.env.TERMS_VERSION ?? "").trim() || "unversioned";
}

/** Caller IP / user agent / platform request id. On Vercel, x-forwarded-for's first hop is the client. */
export function requestContext(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  return {
    ip_address: ip ? ip.slice(0, 64) : null,
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400) || null,
    request_id: (request.headers.get("x-vercel-id") ?? "").slice(0, 200) || null,
  };
}

function clean(event: AuditEvent) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined) row[key] = value;
  }
  if (typeof row.owner_email === "string") row.owner_email = row.owner_email.trim().toLowerCase();
  return row;
}

/**
 * Write one audit row. Returns its APX reference, or null when the dedupe key already existed.
 * `required: true` throws on failure (use where the caller can safely be retried, e.g. the Stripe
 * webhook). Otherwise failures are logged and swallowed so a record-keeping hiccup never changes a
 * money outcome that already happened — the ledger row still exists.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  event: AuditEvent,
  options: { required?: boolean } = {},
): Promise<string | null> {
  const row = clean(event);
  const query = row.dedupe_key
    ? supabase.from("audit_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("reference")
    : supabase.from("audit_events").insert(row).select("reference");
  const { data, error } = await query;
  if (error) {
    console.error("audit write failed", { event_type: event.event_type, code: error.code });
    if (options.required) throw new Error(`audit write failed: ${error.code ?? "unknown"}`);
    return null;
  }
  const first = Array.isArray(data) ? data[0] : null;
  return first && typeof first.reference === "string" ? first.reference : null;
}
