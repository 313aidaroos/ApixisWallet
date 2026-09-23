import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

type HistoryRow = {
  id: string;
  kind: string;
  description: string;
  app_slug: string | null;
  product_key: string | null;
  created_at: string;
  available_delta: number | string;
  held_delta: number | string;
  total_count: number | string;
};

function intParam(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/**
 * Receipts for the signed-in Wallet user, newest first, one row per ledger transaction.
 * `amount` = change to spendable Ixis (purchase +, hold −, release +, capture 0, refund −).
 * `held`   = change to held Ixis (hold +, capture −, release −).
 */
export async function GET(request: Request) {
  let userId: string | null;
  try {
    userId = await getRequestUserId(request);
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = intParam(url.searchParams.get("limit"), 50, 1, 100);
  const offset = intParam(url.searchParams.get("offset"), 0, 0, 1_000_000);

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { data, error } = await supabase.rpc("wallet_history", { p_owner_id: userId, p_limit: limit, p_offset: offset });
  if (error) {
    console.error("ledger query failed", { code: error.code });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const rows = (data ?? []) as HistoryRow[];
  return NextResponse.json(
    {
      transactions: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        description: row.description,
        app: row.app_slug,
        productKey: row.product_key,
        amount: Number(row.available_delta),
        held: Number(row.held_delta),
        createdAt: row.created_at,
      })),
      total: rows.length ? Number(rows[0].total_count) : 0,
      limit,
      offset,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
