import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService } from "@/lib/api/service-auth";
import { ledgerErrorResponse } from "@/lib/api/errors";

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
  if (error) return ledgerErrorResponse(error, "Capture");

  return NextResponse.json({ reservationId: id, status: "captured", receiptId: data });
}
