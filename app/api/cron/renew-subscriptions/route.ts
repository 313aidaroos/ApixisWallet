import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { renewDueIxisSubscriptions } from "@/lib/subscriptions/renew";

export const runtime = "nodejs";

/**
 * Renews due Ixis-balance monthly seats. Card seats renew on Stripe invoice.paid.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 * A short balance becomes past_due. The current entitlement stays until it ends.
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
  try {
    const counts = await renewDueIxisSubscriptions(supabase);
    if (counts.failed > 0) return NextResponse.json(counts, { status: 500 });
    return NextResponse.json(counts);
  } catch (error) {
    console.error("renew subscriptions failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Renewal sweep failed" }, { status: 500 });
  }
}
