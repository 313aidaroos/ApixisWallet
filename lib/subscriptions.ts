import { FINAL_SALE_NOTICE } from "@/lib/checkout/policy";
import { checkoutUrls } from "@/lib/checkout/intent";
import { findCatalogProduct } from "@/lib/catalog";

/** `*.monthly`, `*_monthly`, and `*-monthly`. Other 30-day SKUs are not subscriptions. */
const MONTHLY_KEY = /(?:^|[._-])monthly(?:[._-]|$)/;

const OWNER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMonthlySku(productKey: string) {
  const product = findCatalogProduct(productKey);
  return Boolean(product && MONTHLY_KEY.test(product.key));
}

export function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** One charge per scheduled period. A burned key bumps `attempt` (still within 8–80). */
export function ixisRenewKey(subscriptionId: string, renewsAt: Date, attempt: number) {
  const day = renewsAt.toISOString().slice(0, 10);
  return `ixis-renew:${subscriptionId}:${day}:${attempt}`;
}

export function cardSeatKey(invoiceId: string) {
  const body = `card-seat:${invoiceId}`;
  return body.length <= 80 ? body : `card-seat:${invoiceId.slice(-60)}`;
}

export function planIxisRenewal(row: {
  source: string;
  status: string;
  renewsAt: Date;
  cancelAtPeriodEnd: boolean;
  now: Date;
}): "skip" | "cancel" | "charge" {
  if (row.source !== "ixis") return "skip";
  if (row.status !== "active" && row.status !== "past_due") return "skip";
  if (row.renewsAt > row.now) return "skip";
  if (row.cancelAtPeriodEnd) return "cancel";
  return "charge";
}

export type MonthlyInvoiceInput = {
  invoiceId: string;
  amountPaid: number;
  currency: string | null;
  billingReason: string | null;
  unitAmount: number | null;
  ownerId: string | null;
  productKey: string | null;
  skuType: string | null;
};

export type MonthlyInvoiceDecision =
  | { action: "ignore"; reason: string }
  | {
      action: "fulfill";
      ownerId: string;
      productKey: string;
      amount: number;
      creditExternalId: string;
      idempotencyKey: string;
    };

/**
 * Card renewals credit Ixis for the catalog price, then spend them on the seat.
 * Pack invoices (including STRIPE_CREATE_INVOICES) are not monthly seats and are ignored.
 * A price that does not match the catalog is ignored, not credited, so a retry cannot mint.
 */
export function decideMonthlyInvoice(input: MonthlyInvoiceInput): MonthlyInvoiceDecision {
  if (input.skuType !== "monthly_seat") return { action: "ignore", reason: "not_monthly_seat" };
  if (input.billingReason !== "subscription_create" && input.billingReason !== "subscription_cycle") {
    return { action: "ignore", reason: "not_a_renewal_invoice" };
  }
  if ((input.currency ?? "").toLowerCase() !== "usd") return { action: "ignore", reason: "currency_not_usd" };
  const ownerId = input.ownerId?.trim() ?? "";
  if (!OWNER_UUID.test(ownerId)) return { action: "ignore", reason: "owner_missing" };
  const product = input.productKey ? findCatalogProduct(input.productKey) : null;
  if (!product || !isMonthlySku(product.key)) return { action: "ignore", reason: "unknown_monthly_sku" };
  const unit = input.unitAmount ?? input.amountPaid;
  if (unit !== product.xp) return { action: "ignore", reason: "price_mismatch" };
  return {
    action: "fulfill",
    ownerId,
    productKey: product.key,
    amount: product.xp,
    creditExternalId: `invoice:${input.invoiceId}`,
    idempotencyKey: cardSeatKey(input.invoiceId),
  };
}

export function monthlySubscriptionParams(input: {
  origin: string;
  userId: string;
  email: string | null;
  productKey: string;
}) {
  const product = findCatalogProduct(input.productKey);
  if (!product || !isMonthlySku(product.key)) return null;
  const metadata = {
    sku_type: "monthly_seat",
    product_key: product.key,
    owner_id: input.userId,
    ixis: String(product.xp),
  };
  return {
    mode: "subscription" as const,
    client_reference_id: input.userId,
    ...checkoutUrls(input.origin),
    ...(input.email ? { customer_email: input.email } : {}),
    metadata,
    subscription_data: { metadata },
    custom_text: {
      submit: {
        message:
          FINAL_SALE_NOTICE +
          " This seat renews every month from your card until you stop the next renewal. The current 30 days stay.",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: product.xp,
          recurring: { interval: "month" as const },
          product_data: { name: `${product.name} · monthly seat`, metadata },
        },
      },
    ],
  };
}
