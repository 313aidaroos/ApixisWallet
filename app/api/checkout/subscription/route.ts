import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { checkoutViewer } from "@/lib/checkout/viewer";
import { getStripe } from "@/lib/stripe";
import { recordAudit, requestContext, termsVersion } from "@/lib/audit";
import { createServiceSupabase } from "@/lib/supabase/service";
import { productApp } from "@/lib/api/reserve";
import { isMonthlySku, monthlySubscriptionParams } from "@/lib/subscriptions";

const bodySchema = z.object({ productKey: z.string().min(1).max(80) });

/**
 * Starts a Stripe subscription for a *.monthly catalog SKU.
 * price_data sets the amount from the catalog (100 Ixis = $1). No Dashboard Price id.
 * The seat is granted on invoice.paid, not on this request.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription request" }, { status: 400 });
  const product = findCatalogProduct(parsed.data.productKey);
  if (!product || !isMonthlySku(product.key)) {
    return NextResponse.json({ error: "This product is not a monthly seat" }, { status: 400 });
  }

  const viewer = await checkoutViewer();
  if ("response" in viewer) return viewer.response;

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const params = monthlySubscriptionParams({
    origin,
    userId: viewer.userId,
    email: viewer.email,
    productKey: product.key,
  });
  if (!params) return NextResponse.json({ error: "This product is not a monthly seat" }, { status: 400 });

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(params);
    const supabase = createServiceSupabase();
    if (supabase) {
      await recordAudit(supabase, {
        event_type: "checkout_started",
        dedupe_key: `checkout_started:${session.id}`,
        actor: "wallet-ui",
        app_slug: productApp(product),
        owner_id: viewer.userId,
        owner_email: viewer.email,
        product_key: product.key,
        amount_ixis: product.xp,
        amount_cents: product.xp,
        currency: "usd",
        stripe_checkout_session_id: session.id,
        terms_version: termsVersion(),
        ...requestContext(request),
        details: { sku_type: "monthly_seat", product_name: product.name },
      });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not configured")) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }
    console.error("monthly subscription checkout failed", { message });
    return NextResponse.json({ error: "Subscription checkout is unavailable" }, { status: 400 });
  }
}
