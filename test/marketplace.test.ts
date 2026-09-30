import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FEE_BPS, MIN_ORDER_IXIS, holdSeconds, marketplaceSplit, orderDescription } from "../lib/api/marketplace";

test("marketplace split: 5% family fee, rounded down, payout = amount − fee", () => {
  assert.deepEqual(marketplaceSplit(10_000), { amount: 10_000, fee: 500, payout: 9_500, feeBps: DEFAULT_FEE_BPS });
  assert.deepEqual(marketplaceSplit(199), { amount: 199, fee: 9, payout: 190, feeBps: 500 });
  assert.deepEqual(marketplaceSplit(100, 0), { amount: 100, fee: 0, payout: 100, feeBps: 0 });
  assert.deepEqual(marketplaceSplit(1_000, 800), { amount: 1_000, fee: 80, payout: 920, feeBps: 800 });
});

test("marketplace split: refuses dust, fractions and out-of-range fees", () => {
  assert.throws(() => marketplaceSplit(MIN_ORDER_IXIS - 1), RangeError);
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
