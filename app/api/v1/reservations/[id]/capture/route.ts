import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService } from "@/lib/api/service-auth";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { recordAudit, requestContext } from "@/lib/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Idempotent: capturing an already-captured hold returns the same receipt. A released hold → 409. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Reservation not found", code: "not_found" }, { status: 404 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { data, error } = await supabase.rpc("capture_xp", {
    p_reservation_id: id,
    p_description: "Redemption captured",
    p_actor: auth.caller.actor,
    p_allowed_apps: auth.caller.apps,
  });
  await recordAudit(supabase, {
    event_type: "capture",
    dedupe_key: error ? null : `capture:${id}`,
    actor: auth.caller.actor,
    reservation_id: id,
    ledger_transaction_id: error ? null : data,
    outcome: error ? "rejected" : "ok",
    ...requestContext(request),
    details: error ? { code: error.code ?? null } : {},
  });
  if (error) return ledgerErrorResponse(error, "Capture");

  return NextResponse.json({ reservationId: id, status: "captured", receiptId: data });
}
