import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService } from "@/lib/api/service-auth";
import { ledgerErrorResponse } from "@/lib/api/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Idempotent: releasing an already-released hold succeeds again.
 * Releasing a CAPTURED hold is refused with 409 `already_captured` — the customer was charged,
 * so keep their access. The SDK treats that as success.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Reservation not found", code: "not_found" }, { status: 404 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { error } = await supabase.rpc("release_xp", {
    p_reservation_id: id,
    p_description: "Reservation released",
    p_actor: auth.caller.actor,
    p_allowed_apps: auth.caller.apps,
  });
  if (error) return ledgerErrorResponse(error, "Release");

  return NextResponse.json({ reservationId: id, status: "released" });
}
