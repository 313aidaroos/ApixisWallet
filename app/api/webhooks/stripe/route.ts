import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { pointPacks } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { decideChargeRefund, decideCheckoutCredit } from "@/lib/stripe/fulfillment";
import { creditPaidPack, findRefundForCharge, refundPaidPack } from "@/lib/stripe/ledger";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

function serviceOr503() {
  const supabase = createServiceSupabase();
  if (!supabase) return { supabase: null, response: NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 }) };
  return { supabase, response: null };
}

async function ownerExists(supabase: NonNullable<ReturnType<typeof createServiceSupabase>>, ownerId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(ownerId);
  if (error) {
    if (error.status === 404 || error.code === "user_not_found") return false;
    throw error;
  }
  return Boolean(data.user);
}

async function creditFromSession(eventId: string, session: Stripe.Checkout.Session) {
  const decision = decideCheckoutCredit(session, pointPacks);
  if (decision.action === "ignore") {
    return NextResponse.json({ received: true, credited: false, reason: decision.reason });
  }
  if (decision.action === "reject") {
    console.error("stripe checkout credit rejected", { eventId, error: decision.error });
    return NextResponse.json({ error: decision.error }, { status: 400 });
  }
  if (decision.action !== "credit") {
    return NextResponse.json({ error: "Checkout session cannot be credited" }, { status: 400 });
  }

  const { supabase, response } = serviceOr503();
  if (!supabase) return response;
  if (!(await ownerExists(supabase, decision.purchase.ownerId))) {
    console.error("stripe checkout owner missing", { eventId });
    return NextResponse.json({ error: "Checkout owner is not a valid user" }, { status: 400 });
  }

  const transactionId = await creditPaidPack(supabase, eventId, decision.purchase);
  return NextResponse.json({ received: true, credited: true, transactionId });
}

async function refundFromCharge(stripe: Stripe, eventId: string, charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  if (!charge.refunded || charge.amount_refunded !== charge.amount || !paymentIntentId) {
    // TODO: Partial refunds are not prorated. Only a fully refunded charge reverses the pack.
    return NextResponse.json({ received: true, refunded: false, reason: "partial_refund_not_applied" });
  }

  const listed = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 10 });
  const session = listed.data.find((item) => item.metadata?.sku_type === "ixis_pack") ?? null;
  const decision = decideChargeRefund(charge, session, pointPacks);
  if (decision.action === "ignore") {
    return NextResponse.json({ received: true, refunded: false, reason: decision.reason });
  }
  if (decision.action === "reject") {
    console.error("stripe refund rejected", { eventId, error: decision.error });
    return NextResponse.json({ error: decision.error }, { status: 400 });
  }
  if (decision.action !== "refund") {
    return NextResponse.json({ error: "Charge cannot be refunded" }, { status: 400 });
  }

  const { supabase, response } = serviceOr503();
  if (!supabase) return response;
  if (!(await ownerExists(supabase, decision.purchase.ownerId))) {
    console.error("stripe refund owner missing", { eventId });
    return NextResponse.json({ error: "Checkout owner is not a valid user" }, { status: 400 });
  }

  const existing = await findRefundForCharge(supabase, decision.chargeId);
  if (existing) return NextResponse.json({ received: true, refunded: true, transactionId: existing, duplicate: true });

  const transactionId = await refundPaidPack(supabase, eventId, decision.purchase);
  return NextResponse.json({ received: true, refunded: true, transactionId });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      return await creditFromSession(event.id, event.data.object);
    }
    if (event.type === "charge.refunded") {
      return await refundFromCharge(stripe, event.id, event.data.object);
    }
    if (event.type.startsWith("charge.dispute.")) {
      // TODO: Claw back with refund_xp only when charge.dispute.closed has status "lost".
      // A won dispute must not debit paid Ixis, and the ledger has no dispute-hold bucket.
      return NextResponse.json({ received: true, applied: false, reason: "dispute_not_applied" });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook fulfillment failed", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }
}
