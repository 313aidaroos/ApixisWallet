import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { pointPacks } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { decideChargeRefund, decideCheckoutCredit, decideDisputeReversal, type FulfillmentDecision } from "@/lib/stripe/fulfillment";
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

async function packSessionForPaymentIntent(stripe: Stripe, paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  const listed = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 10 });
  return listed.data.find((item) => item.metadata?.sku_type === "ixis_pack") ?? null;
}

/** Shared by full refunds and lost disputes: one reversal per charge, keyed by the Stripe event id. */
async function applyReversal(eventId: string, decision: FulfillmentDecision, label: string) {
  if (decision.action === "ignore") {
    return NextResponse.json({ received: true, refunded: false, reason: decision.reason });
  }
  if (decision.action === "reject") {
    console.error(`stripe ${label} rejected`, { eventId, error: decision.error });
    return NextResponse.json({ error: decision.error }, { status: 400 });
  }
  if (decision.action !== "refund") {
    return NextResponse.json({ error: "Charge cannot be reversed" }, { status: 400 });
  }

  const { supabase, response } = serviceOr503();
  if (!supabase) return response;
  if (!(await ownerExists(supabase, decision.purchase.ownerId))) {
    console.error(`stripe ${label} owner missing`, { eventId });
    return NextResponse.json({ error: "Checkout owner is not a valid user" }, { status: 400 });
  }

  const existing = await findRefundForCharge(supabase, decision.chargeId);
  if (existing) return NextResponse.json({ received: true, refunded: true, transactionId: existing, duplicate: true });

  const transactionId = await refundPaidPack(supabase, eventId, decision.purchase);
  return NextResponse.json({ received: true, refunded: true, transactionId });
}

async function refundFromCharge(stripe: Stripe, eventId: string, charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  if (!charge.refunded || charge.amount_refunded !== charge.amount || !paymentIntentId) {
    // Partial refunds are not prorated. Only a fully refunded charge reverses the pack.
    console.warn("stripe partial refund not applied to ledger", { eventId, charge: charge.id });
    return NextResponse.json({ received: true, refunded: false, reason: "partial_refund_not_applied" });
  }
  const session = await packSessionForPaymentIntent(stripe, paymentIntentId);
  return applyReversal(eventId, decideChargeRefund(charge, session, pointPacks), "refund");
}

async function reverseLostDispute(stripe: Stripe, eventId: string, dispute: Stripe.Dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  const paymentIntentId =
    typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;
  const session = dispute.status === "lost" ? await packSessionForPaymentIntent(stripe, paymentIntentId) : null;
  return applyReversal(eventId, decideDisputeReversal({ id: dispute.id, status: dispute.status, chargeId }, session, pointPacks), "dispute");
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
    if (event.type === "charge.dispute.closed") {
      return await reverseLostDispute(stripe, event.id, event.data.object);
    }
    if (event.type.startsWith("charge.dispute.")) {
      // Opened / updated disputes change nothing until they close; a lost one reverses the pack above.
      return NextResponse.json({ received: true, applied: false, reason: "dispute_not_closed" });
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
