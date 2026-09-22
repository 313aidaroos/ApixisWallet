import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireServiceBearer } from "@/lib/api/service-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireServiceBearer(request);
  if (denied) return denied;

  const { id } = await params;

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("capture_xp", {
    p_reservation_id: id,
    p_description: "Redemption captured",
  });

  if (error) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    console.error("capture_xp failed:", error);
    return NextResponse.json({ error: "Capture failed" }, { status: 500 });
  }

  return NextResponse.json({
    reservationId: id,
    status: "captured",
    receiptId: data,
  });
}
