import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findCatalogProduct } from "../lib/catalog";
import {
  cardSeatKey,
  decideMonthlyInvoice,
  isMonthlySku,
  ixisRenewKey,
  monthlySubscriptionParams,
  planIxisRenewal,
} from "../lib/subscriptions";

const owner = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-10-14T21:00:00.000Z");

describe("monthly sku detection", () => {
  it("matches dotted, underscored, and hyphenated monthly keys only", () => {
    assert.equal(isMonthlySku("renoxis.agent.monthly"), true);
    assert.equal(isMonthlySku("renoxis.agent.monthly.10000"), true);
    assert.equal(isMonthlySku("roaster_seat_monthly"), true);
    assert.equal(isMonthlySku("nurserytoons-family-monthly"), true);
    assert.equal(isMonthlySku("recovix.intel.growth"), false);
    assert.equal(isMonthlySku("rawixis.buyer.seat.base"), false);
    assert.equal(isMonthlySku("geoxis.tracking.small"), false);
    assert.equal(isMonthlySku("contraxis.seat.pro"), false);
    const monthly = ["renoxis.agent.monthly", "lyrixis.all_access.monthly", "wattixis.seller.monthly"];
    for (const key of monthly) {
      const product = findCatalogProduct(key);
      assert.ok(product);
      assert.equal(isMonthlySku(key), true);
    }
  });
});

describe("ixis renewal plan", () => {
  const base = {
    source: "ixis",
    status: "active",
    renewsAt: new Date("2026-10-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    now,
  };

  it("charges a due ixis seat, cancels at period end, and skips card and future seats", () => {
    assert.equal(planIxisRenewal(base), "charge");
    assert.equal(planIxisRenewal({ ...base, cancelAtPeriodEnd: true }), "cancel");
    assert.equal(planIxisRenewal({ ...base, source: "card" }), "skip");
    assert.equal(planIxisRenewal({ ...base, renewsAt: new Date("2026-11-01T00:00:00.000Z") }), "skip");
    assert.equal(planIxisRenewal({ ...base, status: "past_due" }), "charge");
    const key = ixisRenewKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", base.renewsAt, 0);
    assert.match(key, /^ixis-renew:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:2026-10-01:0$/);
    assert.ok(key.length <= 80);
    assert.ok(cardSeatKey("in_1234567890").startsWith("card-seat:"));
  });
});

describe("card invoice fulfillment", () => {
  it("fulfills a monthly seat invoice at the catalog price and ignores pack invoices", () => {
    const seat = decideMonthlyInvoice({
      invoiceId: "in_seat",
      amountPaid: 5000,
      currency: "usd",
      billingReason: "subscription_cycle",
      unitAmount: 5000,
      ownerId: owner,
      productKey: "renoxis.agent.monthly",
      skuType: "monthly_seat",
    });
    assert.equal(seat.action, "fulfill");
    if (seat.action === "fulfill") {
      assert.equal(seat.amount, 5000);
      assert.equal(seat.creditExternalId, "invoice:in_seat");
    }
    assert.equal(
      decideMonthlyInvoice({
        invoiceId: "in_pack",
        amountPaid: 1000,
        currency: "usd",
        billingReason: "manual",
        unitAmount: 1000,
        ownerId: owner,
        productKey: "renoxis.agent.monthly",
        skuType: "ixis_pack",
      }).action,
      "ignore",
    );
    const mismatch = decideMonthlyInvoice({
      invoiceId: "in_bad",
      amountPaid: 1,
      currency: "usd",
      billingReason: "subscription_create",
      unitAmount: 1,
      ownerId: owner,
      productKey: "renoxis.agent.monthly",
      skuType: "monthly_seat",
    });
    assert.deepEqual(mismatch, { action: "ignore", reason: "price_mismatch" });
  });

  it("builds a subscription Checkout session from the catalog, without a Dashboard price id", () => {
    const params = monthlySubscriptionParams({
      origin: "https://apixis-wallet.vercel.app",
      userId: owner,
      email: "owner@example.com",
      productKey: "renoxis.agent.monthly",
    });
    assert.ok(params);
    assert.equal(params?.mode, "subscription");
    assert.equal(params?.metadata.sku_type, "monthly_seat");
    assert.equal(params?.metadata.ixis, "5000");
    assert.equal(params?.line_items[0].price_data.unit_amount, 5000);
    assert.equal(params?.line_items[0].price_data.recurring.interval, "month");
    assert.equal("payment_method_types" in (params ?? {}), false);
    assert.equal(monthlySubscriptionParams({ origin: "https://apixis-wallet.vercel.app", userId: owner, email: null, productKey: "recovix.intel.growth" }), null);
    const source = readFileSync(new URL("../app/api/checkout/subscription/route.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /payment_method_types\s*:/);
    assert.doesNotMatch(source, /STRIPE_.*PRICE/);
  });
});
