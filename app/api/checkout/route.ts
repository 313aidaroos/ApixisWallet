import { NextResponse } from "next/server";
import { z } from "zod";
import { pointPacks } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({ packId: z.enum(["spark", "agent", "office", "business"]) });
const priceEnv: Record<string, string | undefined> = {
  spark: process.env.STRIPE_IXIS_SPARK_PRICE_ID ?? process.env.STRIPE_XP_SPARK_PRICE_ID,
  agent: process.env.STRIPE_IXIS_STARTER_PRICE_ID ?? process.env.STRIPE_XP_AGENT_PRICE_ID,
  office: process.env.STRIPE_IXIS_STUDIO_PRICE_ID ?? process.env.STRIPE_XP_OFFICE_PRICE_ID,
  business: process.env.STRIPE_IXIS_EMPIRE_PRICE_ID ?? process.env.STRIPE_XP_BUSINESS_PRICE_ID,
};

export async function POST(request: Request) {
  try {
    const { packId } = bodySchema.parse(await request.json());
    const pack = pointPacks.find((item) => item.id === packId)!;
    const price = priceEnv[packId];
    if (!price) return NextResponse.json({ error: "Stripe price is not configured" }, { status: 503 });
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: "replace-with-auth-user-id",
      metadata: { pack_id: packId, ixis: String(pack.xp), sku_type: "ixis_pack" },
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }
}
