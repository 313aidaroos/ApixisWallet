import { NextResponse } from "next/server";
import { z } from "zod";
import { pointPacks } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({ packId: z.enum(["agent", "office", "power", "business"]) });
const priceEnv: Record<string, string | undefined> = { agent: process.env.STRIPE_XP_AGENT_PRICE_ID, office: process.env.STRIPE_XP_OFFICE_PRICE_ID, power: process.env.STRIPE_XP_POWER_PRICE_ID, business: process.env.STRIPE_XP_BUSINESS_PRICE_ID };

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
      metadata: { pack_id: packId, xp: String(pack.xp), sku_type: "xp_pack" },
      integration_identifier: "apixis_wallet_qmtzpkra",
    });
    return NextResponse.json({ url: session.url });
  } catch { return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 }); }
}
