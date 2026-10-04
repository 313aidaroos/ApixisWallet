# Apixis.dev in-world money → the shared Wallet (contract + reconciliation plan)

2026-10-04 (CT), Grok (Wallet Lead). Code: PR "world_trade / world_purchase" (migration 014).
Status of the reconciliation: **PLAN ONLY. Nothing has been credited, zeroed or moved.** Crediting
in-world Ixis into the Wallet is a manual mint and needs Awad's explicit yes.

## 1. Why

Since 5:50 PM CT 10/4 new agents start with 0 in-world Ixis (Apixis.dev #75) and every new Apixis
ID gets 1,000 bonus Ixis in the Wallet (#41, `SIGNUP_GRANT_ENABLED=true`). The world header shows the
Wallet balance, but in-world spending still checks and debits `apixis.agents.ixix_balance`, so a new
agent can receive but cannot pay. Locks: one Apixis ID = one Wallet = one agent; balances change only
through Wallet ledger functions; 5% fee (500 bps, floor) on every in-universe transaction; Ixis are
non-withdrawable (100 Ixis = $1).

## 2. In-world money movements today (Apixis.dev, read 10/4)

| # | Movement | Where (Apixis.dev) | In-world effect | Wallet path after cutover |
|---|---|---|---|---|
| 1 | Deal accept (agent → agent, incl. "propose a trade" UI and autonomous agent ticks) | `shared/deals.js` `acceptDeal` → `economy_action('accept_deal')` | payer −gross, payee +net, treasury +5% | `world_trade` |
| 2 | Deal reject / cancel | `economy_action('reject_deal')` | none | `release` (if a hold was opened at proposal) |
| 3 | NPC clearing trades (world pulse cron) | `shared/world-pulse.js` `clearNpcLane` → `acceptDeal` | NPC → NPC | **No Wallet path**: NPCs have no Apixis ID (decision §6) |
| 4 | Found a business (agent → business treasury) | `shared/businesses.js` → `economy_action('found_business')` | agent −cost, business +cost | `world_purchase` (cost to the platform) — or free (decision §6) |
| 5 | Business offer accept (business treasury → accepting agent) | `economy_action('accept_offer')` | business −gross, agent +net, treasury +5% | `world_trade` from the owner's Apixis ID to the accepter |
| 6 | Starter grant (credit INTO agent) | `shared/world.js`, `shared/world-agents.js`, `grant_starter` SQL | +starter (now 0 for visitors; NPC seeds still non-zero) | **mint** — replaced by the Wallet welcome grant; NPC seeds have no Wallet path |
| 7 | Seat redeem "+N in-world Ixis" (credit INTO agent after a Wallet seat purchase) | `shared/seats.js` `grantSeat` / `revokeSeat`, `api/redeem.js` | +N | **mint** — not built (decision §6) |
| 8 | Platform checkout fee mirror (credit INTO treasury agent, 5% of Stripe checkouts) | `shared/treasury.js` → `economy_action('checkout_fee')` | treasury +fee | retire (bookkeeping only; Wallet's Stripe path is canonical) |
| 9 | Marketplace fee (credit INTO treasury agent on #1 and #5) | inside `economy_action` | treasury +5% | automatic: the fee stays in Wallet clearing |

Reads only (no movement): `js/world-app.js`, `js/world.js`, `js/master.js`, `shared/leaderboard.js`,
`shared/world-pulse.js` ranking, `api/world/community.js`, `api/world/dialogue.js`, `shared/citizens.js`.

## 3. API contract for Apixis.dev

Base `https://apixis-wallet.vercel.app`. Header `Authorization: Bearer <apixis service key>`,
`Content-Type: application/json`. Server-side only. Amounts are **whole Ixis** (integers); the world
currently stores decimals (e.g. 2,195.80), so round down before calling. `buyer_id` / `seller_id` =
Apixis ID `sub`; must pass the PR #40 rule (an `sso_links` row on any active family client), else
**403 `apixis_id_not_linked`**.

### 3a. world_trade (agent → agent: deals, business offers, pay another agent)

1. **Open** (at proposal, so funds are reserved; or at accept, immediately followed by settle):
   `POST /api/v1/marketplace/orders`
   ```json
   { "app": "apixis", "kind": "world_trade", "amount": 120, "idempotencyKey": "deal-<dealId>",
     "buyer_id": "<payer sub>", "seller_id": "<payee sub>", "reference": "deal <dealId>",
     "description": "World trade", "holdDays": 1 }
   ```
   201 → `{ reservationId, status: "held", app: "apixis", ixis: 120, kind: "world_trade", sellerId, feeBps: 500 }`.
   Minimum 20 Ixis (so the floor 5% fee is ≥ 1). holdDays 1–30 (default 14); an unsettled hold is
   released automatically at expiry.
2. **Settle** (counterparty accepts): `POST /api/v1/marketplace/orders/{reservationId}/settle`
   body `{}` (or `{ "seller_id": "<same payee sub>" }`; `feeBps` may be omitted or 500 only).
   200 → `{ reservationId, status: "settled", kind: "world_trade", sellerId, receiptId, payoutId,
   app, ixis: 120, fee: 6, feeBps: 500, payout: 114, payoutPaid, payoutBonus }`.
   Bonus stays bonus: payout is split in the paid/bonus ratio of the payer's hold.
3. **Cancel** (reject / withdraw / expired): `POST /api/v1/reservations/{reservationId}/release` → 200
   `{ status: "released" }`. Releasing an already released hold → 200 again; a captured hold → 409
   `already_captured` (treat as settled).

### 3b. world_purchase (agent → Apixis platform: found a business, in-world items/upgrades)

1. `POST /api/v1/marketplace/orders` `{ "app": "apixis", "kind": "world_purchase", "amount": 500,
   "idempotencyKey": "found-<agentId>-<requestKey>", "buyer_id": "<sub>", "reference": "business <name>",
   "holdDays": 1 }` — no `seller_id`. Minimum 1 Ixis.
2. `POST /api/v1/marketplace/orders/{reservationId}/settle` body `{}` → 200 `{ status: "settled",
   kind: "world_purchase", receiptId, payoutId: null, ixis: 500, fee: 500, feeBps: 10000, payout: 0 }`.
   The whole amount is platform revenue (captured to clearing). No seller may be sent.
3. Cancel = `release` as above.

### 3c. Idempotency and retries

- One stable `idempotencyKey` per in-world intent (8–80 printable ASCII, no spaces), e.g.
  `deal-<dealId>`, `offer-<offerId>-<accepterAgentId>`, `found-<agentId>-<requestKey>`. The Wallet
  namespaces it as `apixis:<key>`.
- Re-sending the same open with the same body returns the same `reservationId`. Same key with a
  different kind / buyer / seller / amount → **409** (`idempotency_conflict` or `conflict`).
- Settle is idempotent: after a timeout, call it again; it never pays twice. `500 payout_pending`
  (`captured: true`) = the payer was charged, retry the same settle; never "refund" in-world.
- Lost the reservationId? Re-open with the same key (same body) to get it back.

### 3d. Errors

| Status | code | Meaning |
|---|---|---|
| 400 | `invalid_order` (+`min_ixis`) | bad body, below the kind minimum, fractional amount |
| 400 | `buyer_id_required`, `seller_id_required`, `self_trade`, `seller_not_allowed`, `fee_locked`, `seller_required` | world rule violations |
| 402 | `insufficient_balance` | payer's Wallet available (paid+bonus) is short |
| 403 | `apixis_id_not_linked` | buyer or seller Apixis ID has no sign-in on any active family site |
| 403 | `world_kind_app` | world kinds are app `apixis` only |
| 404 | `not_found` | unknown / other-app reservation |
| 409 | `seller_mismatch` | settle named a different counterparty than the pinned one |
| 409 | `idempotency_conflict` / `conflict` / `already_captured` / `already_released` | see 3c |
| 429 | — | rate limit (300 holds/min per key, 30/min per person) |
| 500 | `payout_pending` | payer charged, payee pending — retry settle |
| 503 | `world_orders_unavailable` | migration 014 missing (should not happen after rollout) |

Balance for the header: unchanged (`GET /api/v1/balance`).

## 4. Not built (would create Ixis — Awad decides)

- **Rewards / in-world earnings credits INTO agents** (quests, NPC payouts, seat "+N in-world Ixis").
  A credit with no payer is a mint. Non-mint design available today with no new code: Awad names a
  platform Apixis ID ("Apixis World Fund"), funds its Wallet explicitly (a real purchase, or a
  one-off capped bonus mint he approves), and rewards are `world_trade` orders from that fund to the
  agent (5% fee applies). A true `world_reward` mint kind (bonus bucket, per-agent daily cap, global
  cap, kill switch, audit `world_reward`) is designed but deliberately not implemented.
- **NPC agents** (14 world agents + "Apixis Treasury") have no Apixis ID and so no Wallet.

## 5. Reconciliation plan (DO NOT RUN without Awad's yes)

### 5a. Snapshot (read-only SELECTs, 10/4 ~6:00 PM CT, `myfclypikkcvfurkbzmj` + Wallet `kzneeksminozmhnqaaun`)

- `apixis.agents`: 67 rows, **61 with a nonzero balance, total 105,720.00 Ixis** (6 at 0, none negative).
  Plus **880** in 2 business treasuries. All in-world Ixis ever created = **106,600 = starter grants
  (60 rows)**; there are no seat, reward or checkout-fee credits in `apixis.ixix_ledger`. Deals (2,627)
  and business moves only redistributed starter Ixis; 5,648.15 went to the treasury agent as fees.

| Group | Agents | Balance | Starter received | Positive non-starter part |
|---|---:|---:|---:|---:|
| Apixis Treasury (platform fees) | 1 | 5,648.15 | 0 | 5,648.15 |
| NPC world agents (`world+…@apixis.dev`) | 14 | 30,456.85 | 36,600 | 1,028.95 |
| Master agent (`master@apixis.dev`, "Awad Prime") | 1 | 25,000 | 25,000 | 0 |
| Smoke-test agents (`deal-/fee-/biz-/nostub-/world-hub-…@apixis.dev`, 9/14) | 16 | 31,615 | 32,000 | 315 |
| Awad QA agents (`awad+…@apixis.dev`, `awadtest@`) | 16 | 5,600 | 5,600 | 0 |
| Other test agents (Grok E2E, `@resend.dev`, `@uberip.com`, `@example.com`, test-feed, walk-in verify) | 12 | 7,200 | 7,200 | 0 |
| Non-test-looking address | 1 | 200 | 200 | 0 |
| **Total** | **61** | **105,720.00** | **106,600** | **6,992.10** |

- Wallet mapping (by `citizens.apixis_sub`, else lower(email)): **7** of the 61 are Wallet users
  (3,000 Ixis); **2** have a Wallet wallet row (400); **4** have an `sso_links` row on an active client
  = the only ones the `apixis` key could pay today: **800 Ixis, all starter** (1 non-test address 200 +
  3 Grok test accounts 600). 57 agents (104,920) are unlinked.

### 5b. Options

| Option | Linked now (4) | Unlinked people-ish agents (Awad QA + test + non-test, 25) | Everything (61) | New Ixis minted |
|---|---:|---:|---:|---|
| (a) credit balance as bonus, kind `world_migration` | 800 | +12,200 in escrow | up to 105,720 (+880 businesses) | 800 now, up to 13,000 for people, 106,600 worst case |
| (b) zero out, no credit | 0 | 0 | 0 | **0** |
| (c) credit only the non-starter part | 0 | 0 | 6,992.10 (5,648.15 treasury, 1,028.95 NPC, 315 smoke) | 0 for people |

Every linked person ALSO gets the 1,000 welcome grant on next sign-in, so (a) would double-pay the
starter they already got in-world.

**Recommendation: (b), zero out without credit, after a full snapshot.** 100% of in-world Ixis came
from the in-world starter, which the Wallet welcome grant (1,000) now replaces; nobody bought in-world
Ixis; the only non-test person had 200 and will get 1,000. (c) gives the same result for people (0).
The treasury's 5,648.15 fees and NPC balances are bookkeeping with no Apixis ID and should simply be
retired with the snapshot.

If Awad picks (a): Wallet migration `world_migration_credits` (agent_id PK, apixis_sub, email, amount,
status pending|credited|void, credited_tx) + `credit_world_migration(agent_id, actor)` SECURITY DEFINER,
service_role only: bonus bucket, kind `bonus`, external id `world_migration:<agent_id>`, audit
`world_migration`, mint-ceiling check, once per agent and per Apixis ID. Linked agents credited in one
run; unlinked rows stay `pending` (escrow) and are credited lazily on first confirmed Wallet sign-in
whose `sub` (or confirmed email) matches, exactly like the welcome grant. NPC/treasury/smoke rows
are `void`.

### 5c. Freeze → snapshot → cutover order

1. **Freeze** (Apixis.dev, Developer Bot): feature flag so `economy_action`, `acceptDeal`,
   `found_business`, `accept_offer`, `grantSeat`, starter grants and the world-pulse NPC clearing
   return 503 "moving to Wallet"; pause the pulse cron. Reads keep working.
2. **Snapshot**: `create table apixis.ixix_balance_snapshot_20261004 as select …` (agent id,
   citizen id, email, apixis_sub, balance, starter, now()) + business treasuries + totals row; export
   CSV; record row count 61 / 105,720.00 / 880 in NOTES.
3. **Wallet side live** (this PR + migration 014): verify with one world_trade between two linked
   test IDs and one release.
4. **Apixis.dev switch** (Developer Bot): deals/offers/business/purchases call §3; remove every write
   to `ixix_balance`; header + leaderboards read the Wallet.
5. **Zero** (only with Awad's option): one transaction writes an `apixis.ixix_ledger` row
   `world_migration_out` per nonzero agent/business and sets balances to 0 (in-world audit trail).
   For (a), run the Wallet credits in the same window.
6. **Guard**: trigger on `apixis.agents` refusing `ixix_balance <> 0` updates (rollback: drop trigger).
7. **Unfreeze** and watch: Wallet audit `reserve`/`capture`/`payout` with `details.world=true`.

## 6. Decisions only Awad can make

1. Reconciliation option (a) / (b) / (c) (recommended: b).
2. NPC world agents: no money (flavour only), or system Apixis IDs funded by Awad (a mint).
3. Rewards / in-world earnings / seat "+N in-world Ixis": drop, fund a World Fund Apixis ID, or approve a capped `world_reward` mint.
4. Founding a business: platform sink (`world_purchase`, founding cost leaves the economy) or free.
5. World trade minimum 20 Ixis (so the 5% floor fee is never 0). Lower it and 10–19 Ixis trades pay 0 fee, like tips.
