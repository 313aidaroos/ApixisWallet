import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FEE_BPS, MIN_ORDER_IXIS, MIN_TIP_IXIS, holdSeconds, marketplaceSplit, minOrderIxis, orderDescription } from "../lib/api/marketplace";

test("marketplace split: 5% family fee, rounded down, payout = amount − fee", () => {
  assert.deepEqual(marketplaceSplit(10_000), { amount: 10_000, fee: 500, payout: 9_500, feeBps: DEFAULT_FEE_BPS });
  assert.deepEqual(marketplaceSplit(199), { amount: 199, fee: 9, payout: 190, feeBps: 500 });
  assert.deepEqual(marketplaceSplit(100, 0), { amount: 100, fee: 0, payout: 100, feeBps: 0 });
  assert.deepEqual(marketplaceSplit(1_000, 800), { amount: 1_000, fee: 80, payout: 920, feeBps: 800 });
});

test("marketplace split: refuses dust, fractions and out-of-range fees", () => {
  assert.throws(() => marketplaceSplit(MIN_TIP_IXIS - 1), RangeError);
  assert.throws(() => marketplaceSplit(0), RangeError);
  assert.throws(() => marketplaceSplit(100.5), RangeError);
  assert.throws(() => marketplaceSplit(1_000, 5_001), RangeError);
  assert.throws(() => marketplaceSplit(1_000, -1), RangeError);
});

test("hold seconds: whole days, clamped to 1–30", () => {
  assert.equal(holdSeconds(), 14 * 86_400);
  assert.equal(holdSeconds(0), 86_400);
  assert.equal(holdSeconds(45), 30 * 86_400);
  assert.equal(holdSeconds(2.9), 2 * 86_400);
});

test("order description names the app and reference", () => {
  assert.equal(orderDescription("ominix", "order 42", undefined), "Marketplace order · ominix order 42");
  assert.equal(orderDescription("ominix", undefined, "  Logo design  "), "Logo design · ominix");
});

test("order kinds: plain orders keep the 100 Ixis minimum; tips start at 10", () => {
  assert.equal(minOrderIxis(), MIN_ORDER_IXIS);
  assert.equal(minOrderIxis("order"), 100);
  assert.equal(minOrderIxis("tip"), 10);
});

test("feed tips and boosts at the 5% family fee: integer split, fee rounded down, nothing created or lost", () => {
  const cases: Array<[number, number, number]> = [
    [10, 0, 10], // 0.5 rounds down to 0: the creator gets the whole 10-Ixis tip
    [50, 2, 48], // 2.5 → 2
    [100, 5, 95],
    [250, 12, 238], // one boost day: 12.5 → 12
  ];
  for (const [amount, fee, payout] of cases) {
    const split = marketplaceSplit(amount);
    assert.deepEqual(split, { amount, fee, payout, feeBps: 500 });
    assert.equal(split.fee + split.payout, amount);
    assert.ok(Number.isInteger(split.fee) && Number.isInteger(split.payout));
  }
});

test("order body: non-tip orders still need 100 Ixis; kind tip allows 10+", async () => {
  const { marketplaceOrderSchema } = await import("../lib/api/marketplace");
  const base = { idempotencyKey: "feedtip-0001", buyer_email: "buyer@example.com" };
  const ok = (body: object) => marketplaceOrderSchema.safeParse({ ...base, ...body }).success;
  assert.equal(ok({ amount: 99 }), false);
  assert.equal(ok({ amount: 50, kind: "order" }), false);
  assert.equal(ok({ amount: 100 }), true);
  assert.equal(ok({ amount: 250 }), true);
  assert.equal(ok({ amount: 10, kind: "tip" }), true);
  assert.equal(ok({ amount: 50, kind: "tip" }), true);
  assert.equal(ok({ amount: 9, kind: "tip" }), false);
  assert.equal(ok({ amount: 10.5, kind: "tip" }), false);
  assert.equal(ok({ amount: 50, kind: "gift" }), false);
});
