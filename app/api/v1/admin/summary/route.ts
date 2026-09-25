import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { checkStatsKey, loadWalletSummary, parseDays } from "@/lib/admin-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner business summary for AWAD COMMAND. Read-only.
 *   GET /api/v1/admin/summary?days=30   Authorization: Bearer $WALLET_STATS_KEY
 */
export async function GET(request: Request) {
  const auth = checkStatsKey(request);
  if (auth === "unconfigured") return NextResponse.json({ error: "Stats key not configured" }, { status: 503 });
  if (auth !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const days = parseDays(new URL(request.url).searchParams.get("days"));
  try {
    const summary = await loadWalletSummary(supabase, days);
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin summary failed", { message: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ error: "Summary unavailable" }, { status: 503 });
  }
}
