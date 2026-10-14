import type { SupabaseClient } from "@supabase/supabase-js";
import { findCatalogProduct } from "@/lib/catalog";
import { ledgerIdempotencyKey, productApp } from "@/lib/api/reserve";
import { recordAudit } from "@/lib/audit";
import { addDays, decideMonthlyInvoice, type MonthlyInvoiceInput } from "@/lib/subscriptions";

export function invoiceUnitAmount(invoice: {
  amount_paid?: number | null;
  lines?: {
    data?: Array<{
      amount?: number | null;
      quantity?: number | null;
      price?: { unit_amount?: number | null } | null;
      pricing?: { unit_amount_decimal?: unknown } | null;
    }>;
  } | null;
}) {
  const line = invoice.lines?.data?.[0];
  if (typeof line?.price?.unit_amount === "number") return line.price.unit_amount;
  const decimal = line?.pricing?.unit_amount_decimal;
  if (decimal != null && decimal !== "" && Number.isFinite(Number(decimal))) return Number(decimal);
  if (typeof line?.amount === "number" && (line.quantity ?? 1) === 1) return line.amount;
  return null;
}

export function monthlyInvoiceInput(invoice: {
  id: string;
  amount_paid?: number | null;
  currency?: string | null;
  billing_reason?: string | null;
  lines?: Parameters<typeof invoiceUnitAmount>[0]["lines"];
  parent?: {
    subscription_details?: {
      metadata?: { [key: string]: string } | null;
      subscription?: string | { id: string } | null;
    } | null;
  } | null;
}): MonthlyInvoiceInput & { stripeSubscriptionId: string | null } {
  const details = invoice.parent?.subscription_details;
  const metadata = details?.metadata ?? null;
  const subscription = details?.subscription;
  return {
    invoiceId: invoice.id,
    amountPaid: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? null,
    billingReason: invoice.billing_reason ?? null,
    unitAmount: invoiceUnitAmount(invoice),
    ownerId: metadata?.owner_id ?? null,
    productKey: metadata?.product_key ?? null,
    skuType: metadata?.sku_type ?? null,
    stripeSubscriptionId: typeof subscription === "string" ? subscription : subscription?.id ?? null,
  };
}

/** Credit the catalog price, spend it on the seat, then enroll the card subscription. Idempotent on the invoice id. */
export async function fulfillMonthlyInvoice(
  supabase: SupabaseClient,
  invoice: Parameters<typeof monthlyInvoiceInput>[0] & { customer?: string | { id: string } | null },
  now = new Date(),
) {
  const input = monthlyInvoiceInput(invoice);
  const decision = decideMonthlyInvoice(input);
  if (decision.action === "ignore") return decision;

  const product = findCatalogProduct(decision.productKey);
  if (!product) return { action: "ignore" as const, reason: "unknown_monthly_sku" };
  const app = productApp(product);
  const customer = invoice.customer;
  const customerId = typeof customer === "string" ? customer : customer?.id ?? null;

  const credited = await supabase.rpc("credit_xp", {
    p_owner_id: decision.ownerId,
    p_amount: decision.amount,
    p_bucket: "paid",
    p_description: `${product.name} monthly seat`,
    p_external_id: decision.creditExternalId,
    p_app_slug: app,
  });
  if (credited.error) throw credited.error;

  const externalId = ledgerIdempotencyKey(app, decision.idempotencyKey);
  const held = await supabase.rpc("reserve_xp", {
    p_owner_id: decision.ownerId,
    p_amount: decision.amount,
    p_description: `${product.name} monthly seat`,
    p_external_id: externalId,
    p_app_slug: app,
    p_product_key: product.key,
    p_actor: "stripe:subscription",
    p_entitlement_days: "days" in product && typeof product.days === "number" ? product.days : 30,
    p_hold_seconds: 86400,
  });
  let reservationId = held.data;
  if (held.error?.code === "WA409") {
    const existing = await supabase
      .from("ledger_transactions")
      .select("id")
      .eq("external_id", externalId)
      .eq("kind", "reserve")
      .limit(1);
    if (existing.error) throw existing.error;
    const settled = existing.data?.[0]
      ? await supabase
          .from("ledger_transactions")
          .select("id")
          .eq("settles_reservation_id", existing.data[0].id)
          .eq("kind", "spend")
          .limit(1)
      : null;
    if (settled?.error) throw settled.error;
    if (!settled?.data?.[0]) throw held.error;
    reservationId = existing.data?.[0]?.id;
  } else if (held.error) {
    throw held.error;
  }

  const captured = await supabase.rpc("capture_xp", {
    p_reservation_id: reservationId,
    p_description: `${product.name} monthly seat`,
    p_actor: "stripe:subscription",
  });
  if (captured.error && !(captured.error.code === "WA409" && /already captured/i.test(captured.error.message ?? ""))) {
    throw captured.error;
  }

  const renewsAt = addDays(now, 30);
  const enrolled = await supabase.rpc("enroll_subscription", {
    p_owner_id: decision.ownerId,
    p_product_key: product.key,
    p_source: "card",
    p_amount: decision.amount,
    p_renews_at: renewsAt.toISOString(),
    p_stripe_subscription_id: input.stripeSubscriptionId,
    p_stripe_customer_id: customerId,
  });
  if (enrolled.error) throw enrolled.error;

  await recordAudit(
    supabase,
    {
      event_type: "purchase",
      dedupe_key: `purchase:${decision.creditExternalId}`,
      actor: "stripe",
      app_slug: app,
      owner_id: decision.ownerId,
      ledger_transaction_id: typeof credited.data === "string" ? credited.data : null,
      product_key: product.key,
      amount_ixis: decision.amount,
      amount_cents: invoice.amount_paid ?? decision.amount,
      currency: invoice.currency ?? "usd",
      stripe_invoice_id: invoice.id,
      outcome: "ok",
      details: {
        sku_type: "monthly_seat",
        billing_reason: invoice.billing_reason ?? null,
        stripe_subscription_id: input.stripeSubscriptionId,
      },
    },
    { required: true },
  );
  await recordAudit(supabase, {
    event_type: invoice.billing_reason === "subscription_create" ? "subscription_enrolled" : "subscription_renewed",
    dedupe_key: `subscription:${invoice.id}`,
    actor: "stripe",
    app_slug: app,
    owner_id: decision.ownerId,
    product_key: product.key,
    amount_ixis: decision.amount,
    stripe_invoice_id: invoice.id,
    outcome: "ok",
  });
  return { action: "fulfilled" as const, amount: decision.amount, subscriptionId: enrolled.data };
}
