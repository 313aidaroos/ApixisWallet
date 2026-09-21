import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { POST } from "../app/api/webhooks/stripe/route";
import { pointPacks } from "../lib/catalog";
import { decideChargeRefund, decideCheckoutCredit } from "../lib/stripe/fulfillment";
import { creditPaidPack, refundPaidPack } from "../lib/stripe/ledger";

const owner = "11111111-1111-4111-8111-111111111111";

const paidSession = {
  mode: "payment",
  payment_status: "paid",
  client_reference_id: owner,
  metadata: { pack_id: "office", ixis: "50000", sku_type: "ixis_pack" },
};

describe("checkout credit", () => {
  it("credits the paid pack amount from session metadata", () => {
    const decision = decideCheckoutCredit(paidSession, pointPacks);
    assert.equal(decision.action, "credit");
    if (decision.action !== "credit") return;
    assert.equal(decision.purchase.ownerId, owner);
    assert.equal(decision.purchase.amount, 50000);
    assert.equal(decision.purchase.description, "Studio pack");
    assert.equal(decision.purchase.packName, "Studio");
  });

  it("rejects a missing or placeholder owner without a credit decision", () => {
    for (const client_reference_id of [null, "", "replace-with-auth-user-id", "00000000-0000-0000-0000-000000000000"]) {
      const decision = decideCheckoutCredit({ ...paidSession, client_reference_id }, pointPacks);
      assert.equal(decision.action, "reject");
    }
  });

  it("rejects an Ixis amount that does not match the pack", () => {
    const decision = decideCheckoutCredit(
      { ...paidSession, metadata: { ...paidSession.metadata, ixis: "1" } },
      pointPacks,
    );
    assert.equal(decision.action, "reject");
  });

  it("does not credit an unpaid session", () => {
    const decision = decideCheckoutCredit({ ...paidSession, payment_status: "unpaid" }, pointPacks);
    assert.deepEqual(decision, { action: "ignore", reason: "payment_not_paid" });
  });
});

describe("refunds", () => {
  it("reverses the full pack and names the charge", () => {
    const decision = decideChargeRefund(
      { id: "ch_full", refunded: true, amount: 50000, amount_refunded: 50000 },
      paidSession,
      pointPacks,
    );
    assert.equal(decision.action, "refund");
    if (decision.action !== "refund") return;
    assert.equal(decision.purchase.amount, 50000);
    assert.equal(decision.purchase.description, "Refund · Studio pack · ch_full");
  });

  it("leaves partial refunds unapplied", () => {
    const decision = decideChargeRefund(
      { id: "ch_part", refunded: false, amount: 50000, amount_refunded: 1000 },
      paidSession,
      pointPacks,
    );
    assert.deepEqual(decision, { action: "ignore", reason: "partial_refund_not_applied" });
  });
});

describe("webhook route", () => {
  const secret = "whsec_test_secret";
  const stripe = new Stripe("rk_test_placeholder", { apiVersion: "2026-07-29.dahlia" });

  function signed(payload: string) {
    return stripe.webhooks.generateTestHeaderString({ payload, secret });
  }

  async function post(body: string, signature?: string) {
    const headers = new Headers();
    if (signature) headers.set("stripe-signature", signature);
    return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers, body }));
  }

  it("returns 503 when the webhook secret or signature is missing", async () => {
    const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const previousKey = process.env.STRIPE_RESTRICTED_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_RESTRICTED_KEY;
    try {
      const missingSecret = await post("{}", "t=1,v1=abc");
      assert.equal(missingSecret.status, 503);
      process.env.STRIPE_WEBHOOK_SECRET = secret;
      const missingSignature = await post("{}");
      assert.equal(missingSignature.status, 503);
    } finally {
      if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
      if (previousKey === undefined) delete process.env.STRIPE_RESTRICTED_KEY;
      else process.env.STRIPE_RESTRICTED_KEY = previousKey;
    }
  });

  it("returns 400 for a paid session whose owner is not a user id", async () => {
    const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const previousKey = process.env.STRIPE_RESTRICTED_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_placeholder";
    const payload = JSON.stringify({
      id: "evt_bad_owner",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: "replace-with-auth-user-id",
          metadata: { pack_id: "spark", ixis: "1000", sku_type: "ixis_pack" },
        },
      },
    });
    try {
      const response = await post(payload, signed(payload));
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.error, "Checkout session is missing a valid owner");
    } finally {
      if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
      if (previousKey === undefined) delete process.env.STRIPE_RESTRICTED_KEY;
      else process.env.STRIPE_RESTRICTED_KEY = previousKey;
    }
  });

  it("returns 503 instead of crediting when the service role is missing", async () => {
    const previous = {
      secret: process.env.STRIPE_WEBHOOK_SECRET,
      key: process.env.STRIPE_RESTRICTED_KEY,
      service: process.env.SUPABASE_SECRET_KEY,
      role: process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_placeholder";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const payload = JSON.stringify({
      id: "evt_no_service",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          client_reference_id: "11111111-1111-4111-8111-111111111111",
          metadata: { pack_id: "spark", ixis: "1000", sku_type: "ixis_pack" },
        },
      },
    });
    try {
      const response = await post(payload, signed(payload));
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.credited, undefined);
    } finally {
      const restore = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };
      restore("STRIPE_WEBHOOK_SECRET", previous.secret);
      restore("STRIPE_RESTRICTED_KEY", previous.key);
      restore("SUPABASE_SECRET_KEY", previous.service);
      restore("SUPABASE_SERVICE_ROLE_KEY", previous.role);
      restore("NEXT_PUBLIC_SUPABASE_URL", previous.url);
    }
  });
});

describe("ledger rpc", () => {
  it("calls credit_xp with the Stripe event id and the paid bucket", async () => {
    const calls: unknown[] = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "tx-1", error: null };
      },
    } as unknown as SupabaseClient;
    const decision = decideCheckoutCredit(paidSession, pointPacks);
    assert.equal(decision.action, "credit");
    if (decision.action !== "credit") return;
    const id = await creditPaidPack(supabase, "evt_123", decision.purchase);
    assert.equal(id, "tx-1");
    assert.deepEqual(calls, [
      {
        fn: "credit_xp",
        args: {
          p_owner_id: owner,
          p_amount: 50000,
          p_bucket: "paid",
          p_description: "Studio pack",
          p_external_id: "evt_123",
        },
      },
    ]);
  });

  it("calls refund_xp with the Stripe event id", async () => {
    const calls: unknown[] = [];
    const supabase = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: "tx-2", error: null };
      },
    } as unknown as SupabaseClient;
    const decision = decideChargeRefund(
      { id: "ch_full", refunded: true, amount: 50000, amount_refunded: 50000 },
      paidSession,
      pointPacks,
    );
    assert.equal(decision.action, "refund");
    if (decision.action !== "refund") return;
    await refundPaidPack(supabase, "evt_refund", decision.purchase);
    assert.deepEqual(calls, [
      {
        fn: "refund_xp",
        args: {
          p_owner_id: owner,
          p_amount: 50000,
          p_description: "Refund · Studio pack · ch_full",
          p_external_id: "evt_refund",
        },
      },
    ]);
  });
});
