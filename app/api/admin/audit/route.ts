import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { isMasterEmail } from "@/lib/owners";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

const TYPES = new Set([
  "checkout_started", "purchase", "refund", "dispute_lost", "reserve", "capture", "release", "redeem", "hold_expiry_sweep",
]);

const COLUMNS = [
  "reference", "occurred_at", "event_type", "outcome", "actor", "app_slug", "owner_id", "owner_email",
  "product_key", "amount_ixis", "amount_cents", "currency", "ledger_transaction_id", "reservation_id",
  "stripe_event_id", "stripe_checkout_session_id", "stripe_payment_intent_id", "stripe_charge_id",
  "stripe_invoice_id", "stripe_receipt_url", "terms_version", "ip_address", "user_agent", "request_id", "details",
] as const;

/**
 * Legal / accounting export of public.audit_events. Master account only (ALLOWED_EMAIL, confirmed).
 *   /api/admin/audit?from=2026-09-01&to=2026-10-01&type=purchase&email=a@b.co&app=renoxis&format=csv
 * `from` inclusive, `to` exclusive (ISO dates or timestamps, UTC). Max 10,000 rows per request;
 * page with `before_id` (the smallest `id` you received).
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!user.emailConfirmed || !isMasterEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const params = url.searchParams;
  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  let query = supabase.from("audit_events").select(`id, ${COLUMNS.join(", ")}`).order("id", { ascending: false }).limit(10_000);
  const from = params.get("from");
  const to = params.get("to");
  if (from) {
    if (Number.isNaN(Date.parse(from))) return NextResponse.json({ error: "Invalid from" }, { status: 400 });
    query = query.gte("occurred_at", new Date(from).toISOString());
  }
  if (to) {
    if (Number.isNaN(Date.parse(to))) return NextResponse.json({ error: "Invalid to" }, { status: 400 });
    query = query.lt("occurred_at", new Date(to).toISOString());
  }
  const type = params.get("type");
  if (type) {
    if (!TYPES.has(type)) return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    query = query.eq("event_type", type);
  }
  const email = params.get("email");
  if (email) query = query.eq("owner_email", email.trim().toLowerCase());
  const app = params.get("app");
  if (app) query = query.eq("app_slug", app.trim().toLowerCase());
  const beforeId = Number.parseInt(params.get("before_id") ?? "", 10);
  if (Number.isFinite(beforeId)) query = query.lt("id", beforeId);

  const { data, error } = await query;
  if (error) {
    console.error("audit export failed", { code: error.code });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  if (params.get("format") === "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(["id", ...COLUMNS], rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="apixis-wallet-audit-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.json({ events: rows, count: rows.length }, { headers: { "cache-control": "no-store" } });
}
