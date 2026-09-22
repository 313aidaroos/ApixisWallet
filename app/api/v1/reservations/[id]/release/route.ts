import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("release_xp", {
    p_reservation_id: id,
    p_description: "Reservation released",
  });

  if (error) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    console.error("release_xp failed:", error);
    return NextResponse.json({ error: "Release failed" }, { status: 500 });
  }

  return NextResponse.json({
    reservationId: id,
    status: "released",
  });
}
