// 2026-10-04 Grok (Wallet Lead): Apixis.dev in-world money on the shared Wallet (world_trade / world_purchase).
import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_WORLD_PURCHASE_IXIS, MIN_WORLD_TRADE_IXIS, ORDER_KINDS, WORLD_FEE_BPS, checkWorldOrder, marketplaceOrderSchema,
  marketplaceSplit, minOrderIxis, payoutSplit, planSettle, sameTerms,
} from "../lib/api/marketplace";

const BUYER = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

test("world kinds exist; no kind credits an agent from nowhere", () => {
  assert.deepEqual([...ORDER_KINDS], ["order", "tip", "world_trade", "world_purchase"]);
  for (const forbidden of ["world_reward", "world_credit", "world_migration", "reward", "mint"]) {
    assert.equal((ORDER_KINDS as readonly string[]).includes(forbidden), false, forbidden);
  }
  assert.equal(WORLD_FEE_BPS, 500);
});

test("world minimums: trade 20 (fee ≥ 1 Ixis), purchase 1; plain orders and tips unchanged", () => {
  assert.equal(minOrderIxis("world_trade"), MIN_WORLD_TRADE_IXIS);
  assert.equal(minOrderIxis("world_purchase"), MIN_WORLD_PURCHASE_IXIS);
  assert.equal(minOrderIxis("order"), 100);
  assert.equal(minOrderIxis("tip"), 10);
  assert.equal(marketplaceSplit(MIN_WORLD_TRADE_IXIS, WORLD_FEE_BPS).fee, 1);
  const ok = (body: object) => marketplaceOrderSchema.safeParse({ idempotencyKey: "world-0001", buyer_id: BUYER, ...body }).success;
  assert.equal(ok({ kind: "world_trade", amount: 19, seller_id: SELLER }), false);
  assert.equal(ok({ kind: "world_trade", amount: 20, seller_id: SELLER }), true);
  assert.equal(ok({ kind: "world_purchase", amount: 1 }), true);
  assert.equal(ok({ kind: "world_purchase", amount: 0 }), false);
  assert.equal(ok({ kind: "world_trade", amount: 20.5, seller_id: SELLER }), false, "whole Ixis only");
  assert.equal(ok({ amount: 99 }), false, "plain orders keep 100");
  assert.equal(ok({ kind: "tip", amount: 9 }), false, "tips keep 10");
  assert.equal(ok({ kind: "world_reward", amount: 100 }), false);
});

test("world order rules: app apixis, Apixis ID buyer, pinned counterparty, no self trade", () => {
  const trade = { kind: "world_trade" as const, app: "apixis", buyerId: BUYER, sellerId: SELLER };
  assert.deepEqual(checkWorldOrder(trade), { ok: true });
  assert.equal((checkWorldOrder({ ...trade, app: "ominix" }) as { code: string }).code, "world_kind_app");
  assert.equal((checkWorldOrder({ ...trade, buyerId: null }) as { code: string }).code, "buyer_id_required");
  assert.equal((checkWorldOrder({ ...trade, sellerId: null }) as { code: string }).code, "seller_id_required");
  assert.equal((checkWorldOrder({ ...trade, sellerId: BUYER.toUpperCase() }) as { code: string }).code, "self_trade");
  assert.deepEqual(checkWorldOrder({ kind: "world_purchase", app: "apixis", buyerId: BUYER }), { ok: true });
  assert.equal((checkWorldOrder({ kind: "world_purchase", app: "apixis", buyerId: BUYER, sellerId: SELLER }) as { code: string }).code, "seller_not_allowed");
  // plain orders unchanged, but may not smuggle a pinned seller
  assert.deepEqual(checkWorldOrder({ kind: "order", app: "ominix", buyerId: null }), { ok: true });
  assert.equal((checkWorldOrder({ kind: "tip", app: "apixis", buyerId: BUYER, sellerId: SELLER }) as { code: string }).code, "seller_not_allowed");
});

test("settle plan: plain orders unchanged (seller required, caller fee)", () => {
  assert.equal(planSettle(null, {}).mode, "error");
  assert.deepEqual(planSettle(null, { seller_email: "s@example.com", feeBps: 800 }), { mode: "payout", sellerId: null, sellerEmail: "s@example.com", feeBps: 800, kind: "order" });
  assert.deepEqual(planSettle(null, { seller_id: SELLER }), { mode: "payout", sellerId: SELLER, sellerEmail: null, feeBps: 500, kind: "order" });
});

test("settle plan: world_trade pays only the pinned seller at the locked 5%", () => {
  const terms = { kind: "world_trade" as const, seller_id: SELLER, fee_bps: 500 };
  assert.deepEqual(planSettle(terms, {}), { mode: "payout", sellerId: SELLER, sellerEmail: null, feeBps: 500, kind: "world_trade" });
  assert.deepEqual(planSettle(terms, { seller_id: SELLER, feeBps: 500 }), { mode: "payout", sellerId: SELLER, sellerEmail: null, feeBps: 500, kind: "world_trade" });
  assert.equal((planSettle(terms, { seller_id: OTHER }) as { code: string }).code, "seller_mismatch");
  assert.equal((planSettle(terms, { seller_email: "x@example.com" }) as { code: string }).code, "seller_id_required");
  assert.equal((planSettle(terms, { feeBps: 0 }) as { code: string }).code, "fee_locked");
  assert.equal((planSettle(terms, { feeBps: 800 }) as { code: string }).code, "fee_locked");
});

test("settle plan: world_purchase is a sink (no payee)", () => {
  const terms = { kind: "world_purchase" as const, seller_id: null, fee_bps: 500 };
  assert.deepEqual(planSettle(terms, {}), { mode: "sink", kind: "world_purchase" });
  assert.equal((planSettle(terms, { seller_id: SELLER }) as { code: string }).code, "seller_not_allowed");
  assert.equal((planSettle(terms, { feeBps: 0 }) as { code: string }).code, "fee_locked");
});

test("world trade math conserves Ixis and keeps bonus as bonus", () => {
  for (const amount of [20, 21, 39, 40, 100, 1_234, 99_999]) {
    const split = marketplaceSplit(amount, WORLD_FEE_BPS);
    assert.equal(split.fee + split.payout, amount);
    assert.ok(split.fee >= 1, `every world trade pays a fee (${amount})`);
    assert.equal(split.fee, Math.floor(amount * 0.05));
  }
  // a new agent's 1,000 welcome Ixis are bonus: what they pay another agent arrives as bonus
  const split = marketplaceSplit(1_000, WORLD_FEE_BPS);
  assert.deepEqual(payoutSplit(split.payout, 0, 1_000), { paid: 0, bonus: 950 });
  assert.deepEqual(payoutSplit(split.payout, 400, 600), { paid: 380, bonus: 570 });
});

test("replayed terms must match exactly", () => {
  const a = { kind: "world_trade" as const, app_slug: "apixis", buyer_id: BUYER, seller_id: SELLER };
  assert.equal(sameTerms(a, { ...a, buyer_id: BUYER.toUpperCase() }), true);
  assert.equal(sameTerms(a, { ...a, seller_id: OTHER }), false);
  assert.equal(sameTerms(a, { ...a, kind: "world_purchase", seller_id: null }), false);
});
