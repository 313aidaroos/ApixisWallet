import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
    if (event.type === "checkout.session.completed") {
      // Production handoff: call the database credit_xp function once using event.id as idempotency_key.
      // Never update a mutable balance directly; the ledger migration is the source of truth.
    }
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
}
