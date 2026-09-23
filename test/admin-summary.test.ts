import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateSummary, checkStatsKey, CLEARING_OWNER, fillCapturesFromReserves, parseDays, type SummaryAuditRow } from "../lib/admin-summary";
import { GET as summaryGet } from "../app/api/v1/admin/summary/route";

const KEY = "stats_test_key_0123456789abcdefghijklmnop";

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

function req(bearer?: string) {
  const headers = new Headers();
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request("https://wallet.test/api/v1/admin/summary?days=7", { headers });
}

function row(partial: Partial<SummaryAuditRow>): SummaryAuditRow {
  return {
    reference: "APX-1",
    occurred_at: "2026-09-23T10:00:00Z",
    event_type: "purchase",
    outcome: "ok",
    actor: null,
    app_slug: null,
    owner_email: null,
    product_key: null,
    amount_ixis: null,
    amount_cents: null,
    ...partial,
  };
}

describe("stats key", () => {
  it("is unconfigured when unset or too short", async () => {
    await withEnv({ WALLET_STATS_KEY: undefined }, async () => assert.equal(checkStatsKey(req(KEY)), "unconfigured"));
    await withEnv({ WALLET_STATS_KEY: "short" }, async () => assert.equal(checkStatsKey(req("short")), "unconfigured"));
  });
  it("accepts only the exact key", async () => {
    await withEnv({ WALLET_STATS_KEY: KEY }, async () => {
      assert.equal(checkStatsKey(req(KEY)), "ok");
      assert.equal(checkStatsKey(req(`${KEY}x`)), "unauthorized");
      assert.equal(checkStatsKey(req()), "unauthorized");
    });
  });
  it("route rejects before touching the database", async () => {
    await withEnv({ WALLET_STATS_KEY: KEY }, async () => {
      assert.equal((await summaryGet(req("wrong"))).status, 401);
    });
    await withEnv({ WALLET_STATS_KEY: undefined }, async () => {
      assert.equal((await summaryGet(req(KEY))).status, 503);
    });
  });
});

describe("summary aggregation", () => {
  it("fills capture amount and app from the matching reserve", () => {
    const [filled] = fillCapturesFromReserves(
      [row({ event_type: "capture", reservation_id: "r1" })],
      [row({ event_type: "reserve", reservation_id: "r1", app_slug: "renoxis", amount_ixis: 1500, product_key: "renoxis.agent.monthly" })],
    );
    assert.equal(filled.app_slug, "renoxis");
    assert.equal(filled.amount_ixis, 1500);
    assert.equal(filled.product_key, "renoxis.agent.monthly");
  });

  it("clamps days", () => {
    assert.equal(parseDays(null), 30);
    assert.equal(parseDays("0"), 1);
    assert.equal(parseDays("9999"), 365);
    assert.equal(parseDays("abc"), 30);
  });

  it("totals cash, refunds, redemptions per day and per app, and skips rejected rows", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const s = aggregateSummary({
      now,
      days: 7,
      activeEntitlements: 4,
      rows: [
        row({ event_type: "purchase", amount_cents: 10_000, amount_ixis: 10_000 }),
        row({ event_type: "purchase", amount_cents: 500, amount_ixis: 500, occurred_at: "2026-09-21T08:00:00Z" }),
        row({ event_type: "refund", amount_cents: 500, amount_ixis: -500 }),
        row({ event_type: "capture", app_slug: "renoxis", amount_ixis: 2_000 }),
        row({ event_type: "redeem", app_slug: "socixis", amount_ixis: 300 }),
        row({ event_type: "capture", app_slug: "renoxis", amount_ixis: 100, outcome: "rejected" }),
        row({ event_type: "purchase", amount_cents: 99, occurred_at: "2026-01-01T00:00:00Z" }),
      ],
      balances: [
        { owner_id: CLEARING_OWNER, available_xp: -99_999, reserved_xp: 0 },
        { owner_id: "a", available_xp: "8000", reserved_xp: "0" },
        { owner_id: "b", available_xp: 200, reserved_xp: 50 },
      ],
    });
    assert.equal(s.series.length, 7);
    assert.equal(s.series[6].day, "2026-09-23");
    assert.equal(s.series[6].cashInCents, 10_000);
    assert.equal(s.series[4].cashInCents, 500);
    assert.equal(s.totals.cashInCents, 10_500);
    assert.equal(s.totals.refundCents, 500);
    assert.equal(s.totals.netCashCents, 10_000);
    assert.equal(s.totals.ixisRedeemed, 2_300);
    assert.equal(s.totals.rejected, 1);
    assert.deepEqual(s.byApp.map((a) => a.app), ["renoxis", "socixis"]);
    assert.deepEqual(s.holdings, { customers: 2, availableIxis: 8_200, reservedIxis: 50, liabilityUsd: 82 });
    assert.equal(s.activeEntitlements, 4);
    assert.equal("ip_address" in s.recent[0], false);
  });
});
