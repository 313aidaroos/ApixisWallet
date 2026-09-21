import { NextResponse } from "next/server";
import { z } from "zod";
import { pointPacks } from "@/lib/catalog";
import { buildCheckoutSessionParams, integrationIdentifier, parseCheckoutExtras } from "@/lib/checkout/intent";
import { checkoutViewer } from "@/lib/checkout/viewer";
import { getStripe } from "@/lib/stripe";

const bodySchema = z.object({
  packId: z.enum(["spark", "agent", "office", "business"]),
  return_url: z.string().max(2000).optional(),
  returnUrl: z.string().max(2000).optional(),
  product: z.string().max(80).optional(),
  app: z.string().max(80).optional(),
  destination: z.string().max(80).optional(),
});

const priceEnv: Record<string, string | undefined> = {
  spark: process.env.STRIPE_IXIS_SPARK_PRICE_ID ?? process.env.STRIPE_XP_SPARK_PRICE_ID,
  agent: process.env.STRIPE_IXIS_STARTER_PRICE_ID ?? process.env.STRIPE_XP_AGENT_PRICE_ID,
  office: process.env.STRIPE_IXIS_STUDIO_PRICE_ID ?? process.env.STRIPE_XP_OFFICE_PRICE_ID,
  business: process.env.STRIPE_IXIS_EMPIRE_PRICE_ID ?? process.env.STRIPE_XP_BUSINESS_PRICE_ID,
};

function pick(...values: (string | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });

  const extras = parseCheckoutExtras({
    returnUrl: pick(parsed.data.return_url, parsed.data.returnUrl, url.searchParams.get("return_url"), url.searchParams.get("returnUrl")),
    product: pick(parsed.data.product, parsed.data.app, parsed.data.destination, url.searchParams.get("product"), url.searchParams.get("app"), url.searchParams.get("destination")),
  });
  if (!extras.ok) return NextResponse.json({ error: extras.error }, { status: 400 });

  const pack = pointPacks.find((item) => item.id === parsed.data.packId);
  if (!pack) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });

  const viewer = await checkoutViewer();
  if ("response" in viewer) return viewer.response;

  const price = priceEnv[pack.id];
  if (!price) return NextResponse.json({ error: "Stripe price is not configured" }, { status: 503 });

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      ...buildCheckoutSessionParams({
        origin,
        userId: viewer.userId,
        pack,
        intent: extras.intent,
        integrationIdentifier: integrationIdentifier(),
      }),
      line_items: [{ price, quantity: 1 }],
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
