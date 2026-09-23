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
    const renoxis = { actor: "key:renoxis", apps: ["renoxis"], legacy: false, clientId: "c1", requireSso: false };
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

describe("legal record", async () => {
  const { csvCell, toCsv } = await import("../lib/csv");
  const { recordAudit, requestContext } = await import("../lib/audit");
  const { checkoutPolicyParams, FINAL_SALE_NOTICE } = await import("../lib/checkout/policy");
  const { GET: auditExport } = await import("../app/api/admin/audit/route");

  it("writes CSV safely", () => {
    assert.equal(csvCell(-5000), "-5000");
    assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(csvCell('a,"b"'), '"a,""b"""');
    assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
    assert.equal(toCsv(["x", "y"], [{ x: 1, y: null }]), "x,y\r\n1,\r\n");
  });

  it("captures client IP, user agent and request id", () => {
    const ctx = requestContext(
      new Request("https://w.test", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "UA/1", "x-vercel-id": "iad1::abc" } }),
    );
    assert.deepEqual(ctx, { ip_address: "203.0.113.9", user_agent: "UA/1", request_id: "iad1::abc" });
  });

  it("dedupes on dedupe_key and normalises email", async () => {
    const calls: { op: string; row: Record<string, unknown>; options?: unknown }[] = [];
    const supabase = {
      from: () => ({
        upsert: (row: Record<string, unknown>, options: unknown) => {
          calls.push({ op: "upsert", row, options });
          return { select: async () => ({ data: [{ reference: "APX-00000001" }], error: null }) };
        },
        insert: (row: Record<string, unknown>) => {
          calls.push({ op: "insert", row });
          return { select: async () => ({ data: [{ reference: "APX-00000002" }], error: null }) };
        },
      }),
    } as unknown as Parameters<typeof recordAudit>[0];
    assert.equal(await recordAudit(supabase, { event_type: "purchase", dedupe_key: "purchase:evt_1", owner_email: " A@B.co " }), "APX-00000001");
    assert.equal(calls[0].op, "upsert");
    assert.deepEqual(calls[0].options, { onConflict: "dedupe_key", ignoreDuplicates: true });
    assert.equal(calls[0].row.owner_email, "a@b.co");
    assert.equal(await recordAudit(supabase, { event_type: "reserve" }), "APX-00000002");
    assert.equal(calls[1].op, "insert");
  });

  it("throws only when the record is required", async () => {
    const failing = {
      from: () => ({ insert: () => ({ select: async () => ({ data: null, error: { code: "42P01" } }) }) }),
    } as unknown as Parameters<typeof recordAudit>[0];
    const original = console.error;
    console.error = () => undefined;
    try {
      assert.equal(await recordAudit(failing, { event_type: "reserve" }), null);
      await assert.rejects(() => recordAudit(failing, { event_type: "reserve" }, { required: true }));
    } finally {
      console.error = original;
    }
  });

  it("shows the final-sale notice on checkout and gates terms/invoices behind env", async () => {
    await withEnv({ STRIPE_REQUIRE_TERMS: undefined, STRIPE_CREATE_INVOICES: undefined }, async () => {
      const plain = checkoutPolicyParams({ name: "Spark", xp: 1000 });
      assert.equal(plain.custom_text.submit.message, FINAL_SALE_NOTICE);
      assert.match(FINAL_SALE_NOTICE, /non-refundable/);
      assert.match(FINAL_SALE_NOTICE, /never expire/);
      assert.equal(plain.consent_collection, undefined);
      assert.equal(plain.invoice_creation, undefined);
    });
    await withEnv({ STRIPE_REQUIRE_TERMS: "true", STRIPE_CREATE_INVOICES: "true", TERMS_VERSION: "2026-09-23" }, async () => {
      const full = checkoutPolicyParams({ name: "Spark", xp: 1000 });
      assert.deepEqual(full.consent_collection, { terms_of_service: "required" });
      assert.equal(full.invoice_creation?.enabled, true);
      assert.equal(full.invoice_creation?.invoice_data.metadata.terms_version, "2026-09-23");
    });
  });

  it("audit export needs a signed-in master account", async () => {
    await withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk" }, async () => {
      assert.equal((await auditExport(new Request("https://w.test/api/admin/audit"))).status, 401);
    });
  });
});

describe("apixis id", async () => {
  const { redirectUriAllowed, hashSsoCode, newSsoCode, SSO_CODE_PATTERN, redirectWithParams } = await import("../lib/sso");
  const { POST: tokenPost } = await import("../app/api/sso/token/route");
  const { GET: authorizeGet } = await import("../app/sso/authorize/route");
  const { ownerForCaller } = await import("../lib/api/caller-owner");

  it("only redirects to exact, registered https callbacks", () => {
    const registered = ["https://renoxis.dev/auth/apixis/callback", "http://localhost:3000/auth/apixis/callback"];
    assert.ok(redirectUriAllowed("https://renoxis.dev/auth/apixis/callback", registered));
    assert.ok(redirectUriAllowed("http://localhost:3000/auth/apixis/callback", registered));
    assert.ok(!redirectUriAllowed("https://renoxis.dev/auth/apixis/callback?x=1", registered));
    assert.ok(!redirectUriAllowed("https://evil.test/auth/apixis/callback", registered));
    assert.ok(!redirectUriAllowed("http://renoxis.dev/auth/apixis/callback", ["http://renoxis.dev/auth/apixis/callback"]));
    assert.ok(!redirectUriAllowed("javascript:alert(1)", registered));
    assert.equal(redirectWithParams("https://a.test/cb?keep=1", { code: "c", state: "s" }), "https://a.test/cb?keep=1&code=c&state=s");
  });

  it("makes unguessable one-time codes stored only as a hash", () => {
    const a = newSsoCode();
    const b = newSsoCode();
    assert.notEqual(a, b);
    assert.match(a, SSO_CODE_PATTERN);
    assert.match(hashSsoCode(a), /^[0-9a-f]{64}$/);
  });

  it("authorize refuses bad input without redirecting anywhere", async () => {
    const r1 = await authorizeGet(new Request("https://w.test/sso/authorize?client_id=Bad!&redirect_uri=https://evil.test&state=abcdefghijklmnop"));
    assert.equal(r1.status, 400);
    const r2 = await authorizeGet(new Request("https://w.test/sso/authorize?client_id=renoxis&redirect_uri=https://evil.test&state=short"));
    assert.equal(r2.status, 400);
    assert.equal(r2.headers.get("location"), null);
  });

  it("token exchange refuses the legacy shared key (no client identity)", async () => {
    await withEnv({ SUPABASE_SECRET_KEY: SERVICE_KEY }, async () => {
      const none = await tokenPost(req("https://w.test/api/sso/token", { method: "POST", body: "{}" }));
      assert.equal(none.status, 401);
      const legacy = await tokenPost(req("https://w.test/api/sso/token", { method: "POST", bearer: SERVICE_KEY, body: "{}" }));
      assert.equal(legacy.status, 403);
    });
  });

  it("per-site keys may act only for people linked by Apixis ID; require_sso blocks email", async () => {
    const linked = new Set(["11111111-1111-4111-8111-111111111111"]);
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: (_col: string, value: string) => ({ maybeSingle: async () => ({ data: linked.has(value) ? { user_id: value } : null, error: null }) }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof ownerForCaller>[0];
    const site = { actor: "key:renoxis", apps: ["renoxis"], legacy: false, clientId: "c1", requireSso: true };
    assert.deepEqual(await ownerForCaller(supabase, site, { ownerId: "11111111-1111-4111-8111-111111111111" }, { create: false }), {
      ownerId: "11111111-1111-4111-8111-111111111111",
    });
    const stranger = await ownerForCaller(supabase, site, { ownerId: "22222222-2222-4222-8222-222222222222" }, { create: false });
    assert.ok("error" in stranger && stranger.status === 403);
    const byEmail = await ownerForCaller(supabase, site, { ownerEmail: "a@b.co" }, { create: false });
    assert.ok("error" in byEmail && byEmail.status === 403);
    const legacy = { actor: "legacy", apps: null, legacy: true, clientId: null, requireSso: false };
    assert.deepEqual(await ownerForCaller(supabase, legacy, { ownerId: "22222222-2222-4222-8222-222222222222" }, { create: false }), {
      ownerId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
