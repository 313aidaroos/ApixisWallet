import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("wallet_balances")
    .select("available_xp, reserved_xp")
    .eq("owner_id", userId)
    .single();

  if (error || !data) {
    // User has no wallet yet - return zeros
    return NextResponse.json({
      currency: "Ixis",
      available: 0,
      paid: 0,
      bonus: 0,
      reserved: 0,
      rate: { ixisPerDollar: 100 },
    });
  }

  // TODO: break down paid vs bonus from ledger_entries
  return NextResponse.json({
    currency: "Ixis",
    available: data.available_xp,
    paid: data.available_xp, // simplified: treat all as paid for now
    bonus: 0,
    reserved: data.reserved_xp,
    rate: { ixisPerDollar: 100 },
  });
}
