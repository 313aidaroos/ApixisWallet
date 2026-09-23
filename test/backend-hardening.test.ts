import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entitlementDays, findCatalogProduct, redeemCatalog, shopCatalog } from "../lib/catalog";
import { canonicalAppSlug, appSlug } from "../lib/checkout/destinations";
import { API_KEY_PATTERN, authenticateService, callerMayUseApp, hashApiKey, looksLikeServiceBearer } from "../lib/api/service-auth";
import { IDEMPOTENCY_KEY, ledgerIdempotencyKey, productApp } from "../lib/api/reserve";
import { ledgerErrorResponse } from "../lib/api/errors";
import { sameOriginRequest } from "../lib/api/origin";
import { decideDisputeReversal } from "../lib/stripe/fulfillment";
import { pointPacks } from "../lib/catalog";
import { POST as reservePost } from "../app/api/v1/reservations/route";
import { POST as capturePost } from "../app/api/v1/reservations/[id]/capture/route";
import { GET as cronGet } from "../app/api/cron/release-holds/route";

const SERVICE_KEY = "sb_secret_test_key_0123456789abcdefghijklmnop";

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(vars)) {
    previous[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function req(url: string, init: RequestInit & { bearer?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.bearer) headers.set("authorization", `Bearer ${init.bearer}`);
  return new Request(url, { ...init, headers });
}

describe("app slugs", () => {
  it("maps every alias and catalog name to one slug", () => {
    assert.equal(canonicalAppSlug("PersonalContentBot"), "contentbot");
    assert.equal(canonicalAppSlug("personal-content-bot"), "contentbot");
    assert.equal(canonicalAppSlug("Apixis.dev"), "apixis");
    assert.equal(canonicalAppSlug("apixis.dev"), "apixis");
    assert.equal(canonicalAppSlug("Nursery Toons"), "nurserytoons");
    assert.equal(canonicalAppSlug("qahwahworld"), "qahwahworld");
  });

  it("is stable: the slug a reservation stores is the slug entitlements are read by", () => {
    for (const product of [...redeemCatalog, ...shopCatalog]) {
      const slug = productApp(product);
      assert.equal(canonicalAppSlug(slug), slug, product.key);
      assert.equal(slug, appSlug(product.app), product.key);
      assert.match(slug, /^[a-z0-9]+$/, product.key);
    }
  });
});

describe("catalog periods", () => {
  it("gives monthly seats 30 days and one-time unlocks none", () => {
    assert.equal(entitlementDays(findCatalogProduct("renoxis.agent.monthly")!), 30);
    assert.equal(entitlementDays(findCatalogProduct("renoxis-monthly")!), 30);
    assert.equal(entitlementDays(findCatalogProduct("renoxis.activate")!), null);
    assert.equal(entitlementDays(findCatalogProduct("contentbot.clip")!), null);
    assert.equal(entitlementDays(findCatalogProduct("shop.template.listing")!), null);
  });

  it("never leaves a *monthly* key without a period", () => {
    for (const product of redeemCatalog) {
      if (/monthly/i.test(product.key)) assert.equal(entitlementDays(product), 30, product.key);
    }
  });
});

describe("idempotency keys", () => {
  it("accepts 8–80 printable characters and namespaces them by app", () => {
    assert.ok(IDEMPOTENCY_KEY.test("renoxis-11111111-1111-4111-8111-111111111111-seat-2026-09"));
    assert.ok(!IDEMPOTENCY_KEY.test("short"));
    assert.ok(!IDEMPOTENCY_KEY.test("has a space in it"));
    assert.ok(!IDEMPOTENCY_KEY.test("x".repeat(81)));
    assert.equal(ledgerIdempotencyKey("socixis", "order-123"), "socixis:order-123");
    assert.notEqual(ledgerIdempotencyKey("socixis", "order-123"), ledgerIdempotencyKey("renoxis", "order-123"));
  });
});

describe("service auth", () => {
  it("rejects a missing or wrong bearer", async () => {
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY }, async () => {
      const none = await authenticateService(req("http://x/api"));
      assert.ok("response" in none && none.response.status === 401);
      const wrong = await authenticateService(req("http://x/api", { bearer: `${SERVICE_KEY}x` }));
      assert.ok("response" in wrong && wrong.response.status === 401);
    });
  });

  it("accepts the legacy service key unscoped until it is switched off", async () => {
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY, WALLET_ALLOW_LEGACY_SERVICE_KEY: undefined }, async () => {
      const ok = await authenticateService(req("http://x/api", { bearer: SERVICE_KEY }));
      assert.ok("caller" in ok);
      if ("caller" in ok) {
        assert.equal(ok.caller.legacy, true);
        assert.equal(ok.caller.apps, null);
        assert.ok(callerMayUseApp(ok.caller, "renoxis"));
      }
    });
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY, WALLET_ALLOW_LEGACY_SERVICE_KEY: "false" }, async () => {
      const off = await authenticateService(req("http://x/api", { bearer: SERVICE_KEY }));
      assert.ok("response" in off && off.response.status === 401);
    });
  });

  it("scopes per-site callers to their apps", () => {
    const renoxis = { actor: "key:renoxis", apps: ["renoxis"], legacy: false };
    assert.ok(callerMayUseApp(renoxis, "renoxis"));
    assert.ok(!callerMayUseApp(renoxis, "socixis"));
  });

  it("recognises API keys and hashes them deterministically", () => {
    const key = `apx_live_${"A".repeat(43)}`;
    assert.ok(API_KEY_PATTERN.test(key));
    assert.ok(!API_KEY_PATTERN.test("apx_live_short"));
    assert.equal(hashApiKey(key), hashApiKey(key));
    assert.match(hashApiKey(key), /^[0-9a-f]{64}$/);
    assert.ok(looksLikeServiceBearer(req("http://x", { bearer: key })));
    assert.ok(!looksLikeServiceBearer(req("http://x", { bearer: "eyJhbGciOi.eyJzdWIiOi.sig" })));
  });

  it("money routes refuse unauthenticated calls before reading the body", async () => {
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY }, async () => {
      const reserve = await reservePost(req("http://x/api/v1/reservations", { method: "POST", body: "{not json" }));
      assert.equal(reserve.status, 401);
      const capture = await capturePost(req("http://x/api/v1/reservations/abc/capture", { method: "POST" }), {
        params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
      });
      assert.equal(capture.status, 401);
    });
  });

  it("validates the reservation body after auth", async () => {
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY }, async () => {
      const bad = await reservePost(
        req("http://x/api/v1/reservations", {
          method: "POST",
          bearer: SERVICE_KEY,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productKey: "renoxis.activate", idempotencyKey: "short", owner_email: "a@b.co" }),
        }),
      );
      assert.equal(bad.status, 400);
      const unknown = await reservePost(
        req("http://x/api/v1/reservations", {
          method: "POST",
          bearer: SERVICE_KEY,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productKey: "nope.nothing", idempotencyKey: "long-enough-key", owner_email: "a@b.co" }),
        }),
      );
      assert.equal(unknown.status, 404);
    });
  });
});

describe("ledger error mapping", () => {
  it("maps ledger SQLSTATEs to HTTP without leaking SQL", async () => {
    const insufficient = ledgerErrorResponse({ code: "WA402", message: "Insufficient balance: 0 available, 5000 requested" }, "Reservation");
    assert.equal(insufficient.status, 402);
    const captured = ledgerErrorResponse({ code: "WA409", message: "Reservation x was already captured" }, "Release");
    assert.equal(captured.status, 409);
    assert.equal((await captured.json()).code, "already_captured");
    const released = ledgerErrorResponse({ code: "WA409", message: "Reservation x was already released" }, "Capture");
    assert.equal((await released.json()).code, "already_released");
    assert.equal(ledgerErrorResponse({ code: "WA404", message: "Reservation x not found" }, "Capture").status, 404);
    const original = console.error;
    console.error = () => undefined;
    try {
      const unknown = ledgerErrorResponse({ code: "XX000", message: "relation secret does not exist" }, "Capture");
      assert.equal(unknown.status, 500);
      assert.doesNotMatch(JSON.stringify(await unknown.json()), /relation/);
    } finally {
      console.error = original;
    }
  });
});

describe("csrf guard", () => {
  it("requires JSON and a matching Origin when one is sent", () => {
    const json = { "content-type": "application/json" };
    assert.ok(sameOriginRequest(new Request("https://wallet.test/api/v1/redeem", { method: "POST", headers: json })));
    assert.ok(sameOriginRequest(new Request("https://wallet.test/api/v1/redeem", { method: "POST", headers: { ...json, origin: "https://wallet.test" } })));
    assert.ok(!sameOriginRequest(new Request("https://wallet.test/api/v1/redeem", { method: "POST", headers: { ...json, origin: "https://evil.test" } })));
    assert.ok(!sameOriginRequest(new Request("https://wallet.test/api/v1/redeem", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } })));
  });
});

describe("disputes", () => {
  const session = {
    mode: "payment",
    payment_status: "paid",
    client_reference_id: "11111111-1111-4111-8111-111111111111",
    metadata: { pack_id: "office", ixis: "50000", sku_type: "ixis_pack" },
  };

  it("reverses the pack only when the dispute is lost", () => {
    const lost = decideDisputeReversal({ id: "dp_1", status: "lost", chargeId: "ch_1" }, session, pointPacks);
    assert.equal(lost.action, "refund");
    if (lost.action === "refund") {
      assert.equal(lost.purchase.amount, 50000);
      assert.equal(lost.chargeId, "ch_1");
      assert.match(lost.purchase.description, /ch_1/);
    }
    assert.equal(decideDisputeReversal({ id: "dp_2", status: "won", chargeId: "ch_1" }, session, pointPacks).action, "ignore");
    assert.equal(decideDisputeReversal({ id: "dp_3", status: "lost", chargeId: "ch_1" }, null, pointPacks).action, "ignore");
  });
});

describe("cron", () => {
  it("requires CRON_SECRET", async () => {
    await withEnv({ CRON_SECRET: undefined }, async () => {
      assert.equal((await cronGet(req("http://x/api/cron/release-holds"))).status, 503);
    });
    await withEnv({ CRON_SECRET: "cron-secret-value" }, async () => {
      assert.equal((await cronGet(req("http://x/api/cron/release-holds", { bearer: "nope" }))).status, 401);
    });
  });
});
