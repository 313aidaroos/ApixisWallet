import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import Stripe from "stripe";
import { POST } from "../app/api/webhooks/stripe/route";
import { buildCheckoutSessionParams } from "../lib/checkout/intent";
import { checkoutPolicyParams } from "../lib/checkout/policy";

const owner = "11111111-1111-4111-8111-111111111111";
const secret = "whsec_test_secret";
const supabaseUrl = "https://example.supabase.co";
const stripe = new Stripe("rk_test_placeholder", { apiVersion: "2026-07-29.dahlia" });

describe("checkout payment methods come from the Stripe Dashboard", () => {
  it("builds hosted Checkout params without payment_method_types or ui_mode", () => {
    const params = {
      ...buildCheckoutSessionParams({
        origin: "https://apixis-wallet.vercel.app",
        userId: owner,
        pack: { id: "office", xp: 50000 },
        intent: { returnUrl: null, destinationApp: null },
        integrationIdentifier: "apixis_wallet_ixis_abcdefgh",
      }),
      ...checkoutPolicyParams({ name: "Studio", xp: 50000 }),
    } as Record<string, unknown>;
    assert.equal(params.mode, "payment");
    for (const key of ["payment_method_types", "payment_method_configuration", "ui_mode", "automatic_payment_methods"]) {
      assert.equal(key in params, false, `${key} must not be set; Checkout uses dynamic payment methods`);
    }
  });

  it("never hardcodes payment_method_types in the checkout route", () => {
    for (const file of ["app/api/checkout/route.ts", "lib/checkout/intent.ts", "lib/checkout/policy.ts"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /payment_method_types\s*:/, `${file} hardcodes payment_method_types`);
    }
  });
});

type Call = { method: string; path: string; body: unknown };

describe("webhook crediting for delayed (async) payment methods", () => {
  const saved: Record<string, string | undefined> = {};
  const envKeys = ["STRIPE_WEBHOOK_SECRET", "STRIPE_RESTRICTED_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const realFetch = globalThis.fetch;
  let calls: Call[] = [];

  beforeEach(() => {
    for (const key of envKeys) saved[key] = process.env[key];
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_placeholder";
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    calls = [];
    // Fake Supabase: auth admin lookup, credit_xp RPC, audit_events upsert. Nothing leaves the process.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const raw = typeof init?.body === "string" ? init.body : null;
      calls.push({ method, path: url.pathname, body: raw ? JSON.parse(raw) : null });
      const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
      if (url.pathname === `/auth/v1/admin/users/${owner}`) return json({ id: owner, aud: "authenticated", role: "authenticated" });
      if (url.pathname === "/rest/v1/rpc/credit_xp") return json("tx-async-1");
      if (url.pathname === "/rest/v1/audit_events") return json([{ reference: "APX-TEST" }]);
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function session(paymentStatus: "paid" | "unpaid", status = "complete") {
    return {
      id: "cs_test_crypto",
      object: "checkout.session",
      mode: "payment",
      status,
      payment_status: paymentStatus,
      payment_intent: null,
      amount_total: 50000,
      amount_subtotal: 50000,
      currency: "usd",
      livemode: false,
      client_reference_id: owner,
      metadata: { pack_id: "office", ixis: "50000", sku_type: "ixis_pack", terms_version: "2026-09-23" },
    };
  }

  async function deliver(id: string, type: string, object: unknown) {
    const payload = JSON.stringify({ id, object: "event", type, data: { object } });
    const headers = new Headers({ "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) });
    const response = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers, body: payload }));
    return { status: response.status, body: await response.json() };
  }

  const creditCalls = () => calls.filter((call) => call.path === "/rest/v1/rpc/credit_xp");

  it("does not credit checkout.session.completed while a delayed payment is still unpaid", async () => {
    const result = await deliver("evt_completed_unpaid", "checkout.session.completed", session("unpaid"));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { received: true, credited: false, reason: "payment_not_paid" });
    assert.equal(calls.length, 0, "no ledger or audit writes for an unpaid session");
  });

  it("credits once on checkout.session.async_payment_succeeded, keyed by the Stripe event id", async () => {
    const result = await deliver("evt_async_ok", "checkout.session.async_payment_succeeded", session("paid"));
    assert.equal(result.status, 200);
    assert.equal(result.body.credited, true);
    assert.equal(result.body.transactionId, "tx-async-1");
    assert.deepEqual(
      creditCalls().map((call) => call.body),
      [{ p_owner_id: owner, p_amount: 50000, p_bucket: "paid", p_description: "Studio pack", p_external_id: "evt_async_ok" }],
    );
    const audit = calls.find((call) => call.path === "/rest/v1/audit_events");
    assert.ok(audit, "purchase audit row is written");
    const row = audit.body as Record<string, unknown>;
    assert.equal(row.event_type, "purchase");
    assert.equal(row.dedupe_key, "purchase:evt_async_ok");
    assert.equal(row.stripe_checkout_session_id, "cs_test_crypto");
  });

  it("credits a full delayed flow (completed unpaid, then async success) exactly once", async () => {
    const first = await deliver("evt_flow_completed", "checkout.session.completed", session("unpaid"));
    assert.equal(first.body.credited, false);
    const second = await deliver("evt_flow_async", "checkout.session.async_payment_succeeded", session("paid"));
    assert.equal(second.body.credited, true);
    assert.equal(creditCalls().length, 1);
    assert.equal((creditCalls()[0].body as Record<string, unknown>).p_external_id, "evt_flow_async");
  });

  it("reuses the same idempotency key when Stripe retries async_payment_succeeded", async () => {
    await deliver("evt_async_retry", "checkout.session.async_payment_succeeded", session("paid"));
    await deliver("evt_async_retry", "checkout.session.async_payment_succeeded", session("paid"));
    const keys = creditCalls().map((call) => (call.body as Record<string, unknown>).p_external_id);
    // credit_xp returns the existing transaction for a repeated external_id, so a retry is a no-op.
    assert.deepEqual(keys, ["evt_async_retry", "evt_async_retry"]);
  });

  it("does not credit checkout.session.async_payment_failed", async () => {
    const result = await deliver("evt_async_failed", "checkout.session.async_payment_failed", session("unpaid"));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { received: true, credited: false, reason: "async_payment_failed" });
    assert.equal(calls.length, 0);
  });

  it("does not credit async_payment_succeeded if the session is somehow not paid", async () => {
    const result = await deliver("evt_async_unpaid", "checkout.session.async_payment_succeeded", session("unpaid"));
    assert.equal(result.status, 200);
    assert.equal(result.body.credited, false);
    assert.equal(creditCalls().length, 0);
  });
});
