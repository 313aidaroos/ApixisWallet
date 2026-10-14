import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { recordAudit, requestContext } from "@/lib/audit";
import { sameOriginRequest } from "@/lib/api/origin";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { subscriptionsReady } from "@/lib/subscriptions/ready";

const bodySchema = z.object({ productKey: z.string().min(1).max(80) });

/**
 * Stops the next renewal and keeps the current period.
 * Card seats also set cancel_at_period_end on the Stripe subscription. Ixis seats are not charged again.
 */
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cancel request" }, { status: 400 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  if (!(await subscriptionsReady(supabase))) {
    return NextResponse.json({ error: "No live seat for that product" }, { status: 404 });
  }

  const live = await supabase
    .from("subscriptions")
    .select("id, source, stripe_subscription_id")
    .eq("owner_id", user.id)
    .eq("product_key", parsed.data.productKey)
    .in("status", ["active", "past_due"])
    .limit(1);
  if (live.error) return NextResponse.json({ error: "Could not read subscriptions" }, { status: 500 });
  const row = live.data?.[0];
  if (!row) return NextResponse.json({ error: "No live seat for that product" }, { status: 404 });

  if (row.source === "card" && row.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("stripe subscription cancel failed", { message });
      return NextResponse.json(
        { error: "Stripe could not stop the next card charge. This seat is still set to renew." },
        { status: 502 },
      );
    }
  }

  const canceled = await supabase.rpc("request_subscription_cancel", {
    p_owner_id: user.id,
    p_product_key: parsed.data.productKey,
  });
  if (canceled.error) return ledgerErrorResponse(canceled.error, "Cancel subscription");

  await recordAudit(supabase, {
    event_type: "subscription_canceled",
    dedupe_key: `subscription_cancel_request:${row.id}`,
    actor: "wallet-ui",
    owner_id: user.id,
    owner_email: user.email,
    product_key: parsed.data.productKey,
    outcome: "ok",
    ...requestContext(request),
    details: { cancel_at_period_end: true, source: row.source },
  });

  return NextResponse.json({ status: "cancel_at_period_end", productKey: parsed.data.productKey });
}
