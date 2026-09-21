import type Stripe from "stripe";
import { pointPacks } from "@/lib/catalog";
import { packFromMetadata, readPackMetadata } from "@/lib/checkout/intent";
import { buildStatusPayload, findPaidPackCredit, type CheckoutStatusPayload } from "@/lib/checkout/status";
import { getStripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function loadCheckoutStatus(
  sessionId: string,
  viewerId: string,
): Promise<{ ok: true; payload: CheckoutStatusPayload } | { ok: false; status: number; error: string }> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, status: 503, error: "Stripe is not configured" };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, status: 404, error: "Checkout session was not found" };
  }

  if (!session.client_reference_id || session.client_reference_id !== viewerId) {
    return { ok: false, status: 403, error: "This checkout belongs to another account" };
  }

  const pack = packFromMetadata(session.metadata, pointPacks);
  const intent = readPackMetadata(session.metadata);
  const paid = session.payment_status === "paid";
  let credited = false;
  let ledgerUnreachable = false;

  if (paid && pack) {
    const supabase = createServiceSupabase();
    if (!supabase) {
      ledgerUnreachable = true;
    } else {
      try {
        const hit = await findPaidPackCredit(supabase, {
          ownerId: viewerId,
          amount: pack.xp,
          packName: pack.name,
          since: new Date(session.created * 1000),
        });
        credited = Boolean(hit);
      } catch {
        ledgerUnreachable = true;
      }
    }
  }

  return {
    ok: true,
    payload: buildStatusPayload({
      sessionStatus: session.status ?? null,
      paymentStatus: session.payment_status ?? null,
      credited,
      ledgerUnreachable,
      pack,
      returnUrl: intent.returnUrl,
      destinationApp: intent.destinationApp,
    }),
  };
}
