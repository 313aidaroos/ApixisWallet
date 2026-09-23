import { NextResponse } from "next/server";
import { authenticateService } from "@/lib/api/service-auth";
import { ownerForCaller } from "@/lib/api/caller-owner";
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
};

/**
 * The shared Wallet, shown inside a sister site. Server-to-server with the site's apx_ key:
 *   GET /api/v1/balance?owner_id=<Apixis ID sub>&history=10
 * A per-site key only sees people who signed in to that site with Apixis ID.
 */
export async function GET(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const owner = await ownerForCaller(
    supabase,
    auth.caller,
    { ownerId: url.searchParams.get("owner_id"), ownerEmail: url.searchParams.get("owner_email") },
    { create: false },
  );
  if ("error" in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const historyLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get("history") ?? "0", 10) || 0, 0), 50);
  const empty = { available: 0, paid: 0, bonus: 0, reserved: 0 };
  if (!owner.ownerId) {
    return NextResponse.json({ currency: "Ixis", ...empty, usd: 0, rate: { ixisPerDollar: 100 }, history: [] });
  }

  const [{ data: balance, error }, history] = await Promise.all([
    supabase.from("wallet_balances").select("available_xp, reserved_xp, paid_xp, bonus_xp").eq("owner_id", owner.ownerId).maybeSingle(),
    historyLimit > 0
      ? supabase.rpc("wallet_history", { p_owner_id: owner.ownerId, p_limit: historyLimit, p_offset: 0 })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (error || history.error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  const available = Number(balance?.available_xp ?? 0);
  // A site only sees its own receipts plus purchases, never what the person bought elsewhere.
  const apps = auth.caller.apps;
  const rows = ((history.data ?? []) as HistoryRow[]).filter(
    (row) => row.kind !== "reserve" && row.kind !== "release" && (apps === null || row.app_slug === null || row.app_slug === "wallet" || apps.includes(row.app_slug)),
  );
  return NextResponse.json(
    {
      currency: "Ixis",
      available,
      paid: Number(balance?.paid_xp ?? 0),
      bonus: Number(balance?.bonus_xp ?? 0),
      reserved: Number(balance?.reserved_xp ?? 0),
      usd: available / 100,
      rate: { ixisPerDollar: 100 },
      history: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        description: row.description,
        app: row.app_slug,
        productKey: row.product_key,
        amount: row.kind === "spend" ? Number(row.held_delta) : Number(row.available_delta),
        createdAt: row.created_at,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
