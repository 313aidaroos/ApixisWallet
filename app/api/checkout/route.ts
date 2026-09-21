import { NextResponse } from "next/server";
import { z } from "zod";
import { pointPacks } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const bodySchema = z.object({ packId: z.enum(["spark", "agent", "office", "business"]) });
const priceEnv: Record<string, string | undefined> = {
  spark: process.env.STRIPE_IXIS_SPARK_PRICE_ID ?? process.env.STRIPE_XP_SPARK_PRICE_ID,
  agent: process.env.STRIPE_IXIS_STARTER_PRICE_ID ?? process.env.STRIPE_XP_AGENT_PRICE_ID,
  office: process.env.STRIPE_IXIS_STUDIO_PRICE_ID ?? process.env.STRIPE_XP_OFFICE_PRICE_ID,
  business: process.env.STRIPE_IXIS_EMPIRE_PRICE_ID ?? process.env.STRIPE_XP_BUSINESS_PRICE_ID,
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  const { packId } = parsed.data;
  const pack = pointPacks.find((item) => item.id === packId);
  if (!pack) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });

  let userId: string;
  try {
    const id = await getAuthenticatedUserId();
    if (!id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    userId = id;
  } catch {
    return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
  }

  const price = priceEnv[packId];
  if (!price) return NextResponse.json({ error: "Stripe price is not configured" }, { status: 503 });

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const stripe = getStripe();
    const metadata = { pack_id: packId, ixis: String(pack.xp), sku_type: "ixis_pack" };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: userId,
      metadata,
      payment_intent_data: { metadata: { ...metadata, owner_id: userId } },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not configured")) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }
}
