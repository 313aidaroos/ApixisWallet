import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, callerMayUseApp } from "@/lib/api/service-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where does a hold stand? Use it to reconcile after a timeout:
 * `held` (still open), `expired` (open but past hold_expires_at — will be released),
 * `captured` (customer was charged: keep access), `released` (not charged: remove access).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const notFound = NextResponse.json({ error: "Reservation not found", code: "not_found" }, { status: 404 });
  if (!UUID.test(id)) return notFound;

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { data: hold, error } = await supabase
    .from("ledger_transactions")
    .select("id, app_slug, product_key, hold_expires_at, created_at")
    .eq("id", id)
    .eq("kind", "reserve")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  if (!hold || !callerMayUseApp(auth.caller, hold.app_slug ?? "")) return notFound;

  const [{ data: settlement }, { data: entries }] = await Promise.all([
    supabase.from("ledger_transactions").select("id, kind, created_at").eq("settles_reservation_id", id).maybeSingle(),
    supabase.from("ledger_entries").select("amount").eq("transaction_id", id).eq("bucket", "reserved"),
  ]);
  const ixis = (entries ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  let status: "held" | "expired" | "captured" | "released" = "held";
  if (settlement?.kind === "spend") status = "captured";
  else if (settlement?.kind === "release") status = "released";
  else if (hold.hold_expires_at && new Date(hold.hold_expires_at).getTime() < Date.now()) status = "expired";

  return NextResponse.json(
    {
      reservationId: id,
      status,
      app: hold.app_slug,
      productKey: hold.product_key,
      ixis,
      holdExpiresAt: hold.hold_expires_at,
      settledAt: settlement?.created_at ?? null,
      receiptId: settlement?.kind === "spend" ? settlement.id : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
