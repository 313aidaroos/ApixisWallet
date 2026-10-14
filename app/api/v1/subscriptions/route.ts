import { NextResponse } from "next/server";
import { findCatalogProduct } from "@/lib/catalog";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { subscriptionsReady } from "@/lib/subscriptions/ready";

/** Live monthly seats for the signed-in Apixis ID. */
export async function GET() {
  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  if (!(await subscriptionsReady(supabase))) {
    return NextResponse.json({ enabled: false, subscriptions: [] });
  }
  const rows = await supabase
    .from("subscriptions")
    .select("id, product_key, source, status, amount_ixis, renews_at, cancel_at_period_end")
    .eq("owner_id", user.id)
    .in("status", ["active", "past_due"])
    .order("renews_at", { ascending: true });
  if (rows.error) return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });

  return NextResponse.json({
    enabled: true,
    subscriptions: (rows.data ?? []).map((row) => {
      const product = findCatalogProduct(row.product_key);
      return {
        id: row.id,
        productKey: row.product_key,
        productName: product?.name ?? row.product_key,
        source: row.source,
        status: row.status,
        amountIxis: row.amount_ixis,
        renewsAt: row.renews_at,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      };
    }),
  });
}
