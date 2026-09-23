import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

const rate = { ixisPerDollar: 100, xpPerDollar: 100 };

/** Balance of the signed-in Wallet user (session cookie or `Authorization: Bearer <Wallet access token>`). */
export async function GET(request: Request) {
  let userId: string | null;
  try {
    userId = await getRequestUserId(request);
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { data, error } = await supabase
    .from("wallet_balances")
    .select("available_xp, reserved_xp, paid_xp, bonus_xp")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    console.error("wallet balance query failed", { code: error.code });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const available = Number(data?.available_xp ?? 0);
  return NextResponse.json(
    {
      currency: "Ixis",
      available,
      paid: Number(data?.paid_xp ?? 0),
      bonus: Number(data?.bonus_xp ?? 0),
      reserved: Number(data?.reserved_xp ?? 0),
      usd: available / 100,
      rate,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
