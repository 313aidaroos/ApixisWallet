import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Releases expired holds (sister site reserved, then never captured or released).
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` (schedule in vercel.json).
 * Holds are also released lazily on the customer's next reserve, so this is a sweep, not the only path.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  const { data, error } = await supabase.rpc("release_expired_holds", { p_limit: 1000 });
  if (error) {
    console.error("release_expired_holds failed", { code: error.code });
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
  return NextResponse.json({ released: data ?? 0 });
}
