import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  // Get wallet_id for this user
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("id")
    .eq("owner_id", userId)
    .single();

  if (walletError || !wallet) {
    return NextResponse.json({ transactions: [], total: 0, limit, offset });
  }

  // Get ledger entries + transaction details
  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("transaction_id, amount, created_at, ledger_transactions(id, kind, description, app_slug)")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entriesError) {
    console.error("ledger query failed:", entriesError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const transactions = (entries || []).map((entry: any) => ({
    id: entry.ledger_transactions.id,
    kind: entry.ledger_transactions.kind,
    description: entry.ledger_transactions.description,
    app: entry.ledger_transactions.app_slug,
    amount: entry.amount,
    createdAt: entry.created_at,
  }));

  return NextResponse.json({
    transactions,
    total: transactions.length, // simplified: real total needs count query
    limit,
    offset,
  });
}
