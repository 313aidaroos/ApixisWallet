import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST } from "../app/api/checkout/route";
import { GET as returnGet } from "../app/api/checkout/return/route";
import { pointPacks } from "../lib/catalog";
import {
  buildCheckoutSessionParams,
  buildPackMetadata,
  integrationIdentifier,
  parseCheckoutExtras,
  readPackMetadata,
} from "../lib/checkout/intent";
import { VERCEL_PRODUCT_HOSTS, canonicalReturnUrl } from "../lib/checkout/return-url";
import { buildStatusPayload, findPaidPackCredit, returnRedirectTarget, toPublicStatus } from "../lib/checkout/status";
import { packPurchaseDescription } from "../lib/stripe/fulfillment";

const locked = { extraHosts: [] as string[], allowHttpLocalhost: false };
const owner = "11111111-1111-4111-8111-111111111111";

describe("return url allowlist", () => {
  it("accepts family domains and exact product vercel hosts", () => {
    assert.equal(canonicalReturnUrl("https://app.apixis.dev/return?from=wallet", locked), "https://app.apixis.dev/return?from=wallet");
    assert.equal(canonicalReturnUrl("https://apixis.dev", locked), "https://apixis.dev/");
    assert.equal(
      canonicalReturnUrl("HTTPS://Socixis.vercel.app/billing", locked),
      "https://socixis.vercel.app/billing",
    );
    for (const host of VERCEL_PRODUCT_HOSTS) {
      assert.equal(canonicalReturnUrl(`https://${host}/home`, locked), `https://${host}/home`);
    }
  });

  it("rejects open redirects, lookalike vercel hosts, and non-https", () => {
    const rejected = [
      "https://evil.example/phish",
      "https://socixis.vercel.app.evil.com/billing",
      "https://not-a-product.vercel.app/phish",
      "https://socixis-git-main-team.vercel.app/billing",
      "https://socixis.vercel.app.evil.vercel.app/",
      "http://socixis.vercel.app/billing",
      "javascript:alert(1)",
      "https://user:pass@socixis.vercel.app/billing",
      "https://socixis.vercel.app\\@evil.com",
      "//socixis.vercel.app",
      "https://apixis.dev.evil.com/",
      "https://evilapixis.dev/",
      "https://127.0.0.1.socixis.vercel.app/",
      "https://apixis-wallet.vercel.app/buy/success?session_id=cs_test_abc",
      "https://apixis-wallet.vercel.app/api/checkout/return?session_id=cs_test_abc",
      "http://localhost:3000/back",
    ];
    for (const value of rejected) {
      assert.equal(canonicalReturnUrl(value, locked), null, value);
    }
  });

  it("allows localhost only when asked, and extra hosts only when listed", () => {
    assert.equal(
      canonicalReturnUrl("http://localhost:3000/back", { extraHosts: [], allowHttpLocalhost: true }),
      "http://localhost:3000/back",
    );
    assert.equal(
      canonicalReturnUrl("https://preview.example.com/done", { extraHosts: ["preview.example.com"], allowHttpLocalhost: false }),
      "https://preview.example.com/done",
    );
    assert.equal(canonicalReturnUrl("https://preview.example.com/done", locked), null);
    assert.equal(
      canonicalReturnUrl("https://anywhere.example/x", { extraHosts: ["*.example"], allowHttpLocalhost: false }),
      null,
    );
  });
});

describe("checkout metadata round-trip", () => {
  it("stores return_url and destination_app for the success page", () => {
    const parsed = parseCheckoutExtras(
      { returnUrl: "https://socixis.vercel.app/billing?seat=1", product: "socixis" },
      locked,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const pack = pointPacks.find((item) => item.id === "spark")!;
    const params = buildCheckoutSessionParams({
      origin: "https://apixis-wallet.vercel.app/",
      userId: owner,
      pack,
      intent: parsed.intent,
      integrationIdentifier: "apixis_wallet_ixis_abcdefgh",
    });
    assert.equal(params.client_reference_id, owner);
    assert.equal(params.success_url, "https://apixis-wallet.vercel.app/buy/success?session_id={CHECKOUT_SESSION_ID}");
    assert.equal(params.cancel_url, "https://apixis-wallet.vercel.app/?checkout=cancelled");
    assert.equal(params.metadata.pack_id, "spark");
    assert.equal(params.metadata.ixis, "1000");
    assert.equal(params.metadata.sku_type, "ixis_pack");
    assert.equal(params.metadata.return_url, "https://socixis.vercel.app/billing?seat=1");
    assert.equal(params.metadata.destination_app, "socixis");
    assert.equal(params.payment_intent_data.metadata.owner_id, owner);
    assert.equal(params.payment_intent_data.metadata.return_url, params.metadata.return_url);
    assert.match(integrationIdentifier(), /^apixis_wallet_ixis_[a-z]{8}$/);

    const read = readPackMetadata(params.metadata, locked);
    assert.equal(read.returnUrl, "https://socixis.vercel.app/billing?seat=1");
    assert.equal(read.destinationApp, "socixis");
    assert.equal(read.returnHost, "socixis.vercel.app");
    assert.deepEqual(buildPackMetadata(pack, { returnUrl: null, destinationApp: null }), {
      pack_id: "spark",
      ixis: "1000",
      sku_type: "ixis_pack",
    });
  });

  it("accepts product aliases and query-style contentbot", () => {
    const parsed = parseCheckoutExtras({ returnUrl: "", product: "personalcontentbot" }, locked);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.intent.destinationApp, "contentbot");
    assert.equal(parsed.intent.returnUrl, null);
  });

  it("drops a tampered return_url and chooses a destination instead of redirecting", () => {
    const read = readPackMetadata(
      {
        pack_id: "office",
        ixis: "50000",
        sku_type: "ixis_pack",
        return_url: "https://evil.example/phish",
        destination_app: "renoxis",
      },
      locked,
    );
    assert.equal(read.returnUrl, null);
    const payload = buildStatusPayload(
      {
        sessionStatus: "complete",
        paymentStatus: "paid",
        credited: true,
        ledgerUnreachable: false,
        pack: { id: "office", name: "Studio", xp: 50000 },
        returnUrl: read.returnUrl,
        destinationApp: read.destinationApp,
      },
      locked,
    );
    assert.equal(payload.status, "credited");
    assert.equal(payload.next, "choose");
    assert.equal(payload.destinationApp, "renoxis");
    assert.equal(returnRedirectTarget(payload, locked), null);
    assert.equal("returnUrl" in toPublicStatus(payload), false);
  });

  it("redirects only after credit when the stored return_url is still allowlisted", () => {
    const waiting = buildStatusPayload(
      {
        sessionStatus: "complete",
        paymentStatus: "paid",
        credited: false,
        ledgerUnreachable: false,
        pack: { id: "spark", name: "Spark", xp: 1000 },
        returnUrl: "https://socixis.vercel.app/billing",
        destinationApp: "socixis",
      },
      locked,
    );
    assert.equal(waiting.next, "wait");
    assert.equal(waiting.returnUrl, null);
    assert.equal(returnRedirectTarget(waiting, locked), null);

    const ready = buildStatusPayload(
      {
        sessionStatus: "complete",
        paymentStatus: "paid",
        credited: true,
        ledgerUnreachable: false,
        pack: { id: "spark", name: "Spark", xp: 1000 },
        returnUrl: "https://socixis.vercel.app/billing",
        destinationApp: "socixis",
      },
      locked,
    );
    assert.equal(ready.next, "redirect");
    assert.equal(returnRedirectTarget(ready, locked), "https://socixis.vercel.app/billing");
  });

  it("rejects a foreign return_url and an unknown product before auth", async () => {
    const foreign = await POST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: "spark", return_url: "https://evil.example/phish", product: "socixis" }),
      }),
    );
    assert.equal(foreign.status, 400);
    const foreignBody = await foreign.json();
    assert.equal(foreignBody.error, "return_url is not an allowlisted Apixis host");

    const unknown = await POST(
      new Request("http://localhost/api/checkout?product=not-an-app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: "spark" }),
      }),
    );
    assert.equal(unknown.status, 400);
    const unknownBody = await unknown.json();
    assert.equal(unknownBody.error, "product is not a known Apixis app");
  });

  it("accepts an allowlisted return_url from the query string through to the auth check", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout?return_url=https%3A%2F%2Fsocixis.vercel.app%2Fbilling&product=socixis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: "spark" }),
      }),
    );
    assert.ok(response.status === 401 || response.status === 503);
    const body = await response.json();
    assert.notEqual(body.error, "return_url is not an allowlisted Apixis host");
  });

  it("does not redirect from a return_url query param", async () => {
    const response = await returnGet(
      new Request("http://localhost/api/checkout/return?session_id=cs_test_abc&return_url=https://evil.example/phish"),
    );
    assert.notEqual(response.status, 302);
    assert.ok(response.status === 401 || response.status === 503 || response.status === 400);
  });
});

describe("paid pack credit lookup", () => {
  it("finds the webhook purchase on the paid bucket without crediting", async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    function table(name: string, rows: unknown[]) {
      const query = {
        select(...args: unknown[]) {
          calls.push({ table: name, method: "select", args });
          return query;
        },
        eq(...args: unknown[]) {
          calls.push({ table: name, method: "eq", args });
          return query;
        },
        gte(...args: unknown[]) {
          calls.push({ table: name, method: "gte", args });
          return query;
        },
        in(...args: unknown[]) {
          calls.push({ table: name, method: "in", args });
          return query;
        },
        order(...args: unknown[]) {
          calls.push({ table: name, method: "order", args });
          return query;
        },
        limit() {
          return query;
        },
        then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
        },
      };
      return query;
    }
    const supabase = {
      from(name: string) {
        if (name === "wallets") return table(name, [{ id: "wal" }]);
        if (name === "ledger_transactions") return table(name, [{ id: "tx-1" }]);
        if (name === "ledger_entries") return table(name, [{ transaction_id: "tx-1" }]);
        throw new Error(name);
      },
    } as unknown as SupabaseClient;

    const id = await findPaidPackCredit(supabase, {
      ownerId: owner,
      amount: 1000,
      packName: "Spark",
      since: new Date("2026-09-21T00:00:00.000Z"),
    });
    assert.equal(id, "tx-1");
    assert.equal(packPurchaseDescription("Spark"), "Spark pack");
    assert.ok(calls.some((call) => call.table === "ledger_transactions" && call.method === "eq" && call.args[0] === "description" && call.args[1] === "Spark pack"));
    assert.ok(calls.some((call) => call.table === "ledger_entries" && call.method === "eq" && call.args[0] === "bucket" && call.args[1] === "paid"));
    assert.ok(calls.some((call) => call.table === "ledger_entries" && call.method === "eq" && call.args[0] === "amount" && call.args[1] === 1000));
  });
});
