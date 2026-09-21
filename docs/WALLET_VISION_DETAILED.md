# Apixis Wallet — Detailed Vision

**Owner:** Awad Alaidaroos (idea) · Wallet Lead executes · Developer Bot hub wires ops  
**Status:** Living vision (2026-09-21)  
**Live surface today:** https://apixis-wallet.vercel.app  
**Related:** `VISION.md`, `docs/INTEGRATION.md`, `docs/WALLET_EMBED.md` (shipping), bank-CEO pack `wallet-ceo-operating.md`

This document is a **product and architecture vision**, not legal, tax, securities, or Sharia advice. Phase 5 (chain / open currency) only proceeds after counsel signs off. Nothing here authorizes marketing Ixis as an investment, a deposit, or a withdrawable crypto asset **today**.

---

## 1. One-sentence vision

**Apixis Wallet is the single bank of the Apixis family:** people buy **Ixis** with cash once, spend them across every company product, and — *only when we are legally ready* — those same units can graduate onto **our own chain as our own currency**, without rewriting the product economy.

---

## 2. What Apixis Wallet is (today)

### 2.1 Role in the company

| Layer | Role |
|--------|------|
| **Apixis** | Operating system / family holding the products |
| **Apixis ID** | Shared identity (who the balance belongs to) |
| **Cixy** | Shared intelligence across products |
| **Ixis** | Shared unit of account and spend |
| **Apixis Wallet** | The only place cash becomes Ixis; the ledger of truth |

Sister products (Socixis, Renoxis, Rawixis, Contraxis, Halaxis, Lyrixis, AwadBot, COMMAND, Qahwahworld, Nursery, Recovra, Launchixis, Apixis.dev, …) **do not** run their own Stripe for plans/coins. They show a Wallet entry, send users to Wallet to buy, then redeem Ixis back home.

### 2.2 Peg and rules (locked)

- **100 Ixis = $1** of purchasing power inside the family.
- Floor for priced SKUs: **1,000 Ixis ($10)** unless Awad explicitly overrides.
- Bought Ixis **does not expire**.
- **Closed loop at launch:** no peer cash-out, no “withdraw to bank,” no marketing as investment or speculative crypto.
- Credit path: **Stripe Checkout → webhook → double-entry ledger** (`credit_xp` / `refund_xp`). Balances are never invented in the browser.
- Platform cut: primarily on **cash purchase of Ixis** (and product-specific fee rules Awad locks per company). Spending Ixis burns balance; it does not mint a second money.

### 2.3 Buckets (ledger language)

Typical buckets (names may evolve; meaning stays):

- **Paid** — Ixis from cash purchase (highest trust for redeem).
- **Bonus** — promotions / grants (may have stricter redeem rules later).
- **Reserved / held** — quote→reserve→capture holds while a sister product provisions.

### 2.4 Buy UX (product intent)

1. User is signed in (Apixis ID / Wallet auth).
2. User buys a pack on Wallet.
3. Stripe settles; webhook credits **Wallet** paid balance (idempotent on Stripe `event.id`).
4. After pay, user either:
   - **Keeps Ixis in Wallet**, or
   - **Returns** to the sister product they came from (`return_url`, allowlisted), to redeem there.
5. Optional later: intentional transfer Wallet ↔ product balances (secure, user-initiated — not silent skimming).

### 2.5 Sister-site embed (every company)

Every company site gets a **Wallet entry** that connects to Apixis Wallet:

- CTA: “Buy Ixis” / “Wallet”
- Deep link: `https://apixis-wallet.vercel.app` with `origin=<product>` + allowlisted `return_url`
- Optional balance display via Wallet APIs
- **No second Stripe** for the family coin
- **No inventing a second cash ledger** on the product — spend/redeem against Wallet truth

Custom domain `wallet.apixis.dev` is deferred until Awad reopens DNS; production stays on `apixis-wallet.vercel.app`.

---

## 3. Why this design (economics)

1. **One checkout** — simpler compliance story than N Stripe carts inventing N “coins.”
2. **One peg** — pricing, Cixy burn rates, and platform cut stay coherent.
3. **One identity** — Apixis ID maps a human (or agent) to one economic subject across products.
4. **Ledger first** — double-entry books are what banks and auditors understand; chain is a *projection* of a clean book, not a substitute for one.
5. **Optionality** — the same unit name **Ixis** can later map 1:1 to a chain asset **without changing sister-app SKUs**, if counsel allows.

---

## 4. Phased roadmap

### Phase 1 — Closed-loop Wallet (now)

- Buy packs with card (Stripe).
- Ledger credit / refund.
- Redeem / quote → reserve → capture across sister apps.
- Wallet CTA on every company site.
- Auth, webhook signing, idempotency, allowlisted returns.

**Exit criteria:** a signed-in user can buy Ixis, see credit, return to a product, and redeem at least one real SKU end-to-end.

### Phase 2 — Teams, renewals, admin

- Firm / office wallets (e.g. Renoxis brokerage pays).
- Subscriptions billed in Ixis.
- Admin tooling, disputes, support refunds, audit exports.

### Phase 3 — Family Ixis-only commerce

- Sister apps stop cash checkout for plans that should be Ixis.
- Catalog + embed contract are the only commerce path for those SKUs.
- Marketplace-style redeem where it fits (Rawixis, Contraxis, etc.).

### Phase 4 — Marketplace & agents

- Agents and humans spend Ixis for work, media, files, seats.
- Clear metering (Cixy image/video ~5× provider cost, rounded up; failed gens refund).
- Stronger provenance on ledger (who spent, which app, which SKU).

### Phase 5 — Own chain / own currency (**legal gate**)

Only after Awad + counsel decide we are **legal and ready**:

- Map ledger **Ixis** 1:1 to an on-chain asset (same name or explicitly aliased).
- Run (or govern) **our own chain** *or* a carefully chosen L2 / app-chain — choice is a counsel + engineering decision, not a slogan.
- Define mint / burn / bridge rules so off-chain Wallet balances and on-chain supply cannot drift.
- Open convert / withdraw **only** under the legal product we are allowed to offer (which may still be restricted).

**Hard rule until Phase 5 is greenlit:** do not ship a convert button, do not promise price appreciation, do not market Ixis as crypto you can cash out.

---

## 5. Phase 5 deep dive — “When we’re legal, our own blockchain and currency”

### 5.1 What “legal” means here (checklist, not a guarantee)

“Legal” is a **bundle of gates**, all owned by Awad with counsel — Wallet Lead and hub do not declare these passed:

1. **Corporate & licensing** — entity structure capable of issuing / operating the product we want (credits vs e-money vs crypto asset — these are different worlds).
2. **Securities / commodities analysis** — counsel classifies what on-chain Ixis *is* in each launch jurisdiction; marketing must match that classification.
3. **Payments & money transmission** — if users can move value out to fiat or third parties, transmission / e-money / banking rules may apply.
4. **Tax** — purchase, spend, convert, and (if ever) appreciation events need a bookable policy.
5. **Sanctions / KYC / AML** — if the product becomes open crypto, controls escalate.
6. **Consumer & advertising** — no investment-return promises in product UI or social.
7. **Sharia / Halaxis lane** — where products claim compliance, separate review (Halaxis Lead coordinates; counsel decides).
8. **Data & custody** — keys, bridges, and who can freeze / claw back.

Until those gates are written down and signed, we stay in **Phase 1–4 closed-loop credits**.

### 5.2 Why the ledger-first path unlocks a chain later

A chain is only as honest as the off-chain truth that feeds it. We are building:

- Idempotent cash→credit (Stripe event ids).
- Explicit redeem holds and captures.
- Per-owner balances tied to Apixis ID.
- A single SKU catalog language (`productKey`, Ixis amounts).

When counsel says go:

1. **Snapshot / continuously sync** paid (and later eligible) balances to chain supply.
2. **Mint** on-chain Ixis only against ledger liabilities we already recognize.
3. **Burn** on-chain when users move value back into closed-loop spend *or* when redeem consumes units — policy TBD with counsel.
4. Keep **Wallet UI** as the human bank; chain is settlement / portability / proof — not a second conflicting balance.

### 5.3 “Our own blockchain” — options (vision, not a pick yet)

| Option | Idea | Tradeoffs |
|--------|------|-----------|
| **App-chain / sovereign L1** | Full control of fees, validators, governance | Highest cost, ops, and regulatory surface |
| **L2 on a major L1** | Faster liquidity & tooling | Shared security; bridge risk; less “sovereign” optics |
| **Permissioned chain** | Validators = Apixis entities / partners | Easier controls; less “public crypto” narrative |
| **Token on existing L1 only** | Fastest to market | Least “our chain”; still needs full legal review |

Awad picks with counsel. Engineering must not lock a chain choice into Phase 1 code paths.

### 5.4 Currency properties we want (target design)

When Phase 5 ships, **Ixis-on-chain** should aim for:

- **Same name, same peg story** unless counsel requires a distinct ticker (then alias explicitly: ledger Ixis ↔ chain IXIS).
- **1:1 mapping** at launch between eligible off-chain paid balance and claimable on-chain units.
- **No silent inflation** — mint authority constrained; every mint cites a ledger liability or approved policy.
- **Redeem still works** — products keep quoting Ixis; chain is optional portability, not a break of the family SKU system.
- **Upgrade path for agents** — Apixis.dev agent economies can hold / spend the same unit.

### 5.5 What we deliberately do *not* do before the gate

- No public “Ixis token” sale.
- No price chart as product marketing.
- No peer-to-peer cash-out.
- No bridging random external memecoins into Wallet.
- No second product inventing “Renoxis Coin” / “Socixis Coin” that bypasses Wallet.

---

## 6. Trust, risk, and bank-CEO posture

Wallet Lead operates as **bank CEO for Awad’s bank**:

- Peg integrity (100 Ixis = $1 inside the product).
- Ledger-only mutations.
- Fail closed on webhooks (no signature → no credit).
- Clear separation: **cash rails (Stripe)** vs **spend rails (Ixis)** vs **future chain rails**.
- Escalate to Awad only for true blockers (legal, banking, secrets he alone can provide).

Risks to watch:

- Double-credit bugs (idempotency).
- Open redirects on `return_url` (allowlist).
- Sister apps reintroducing Stripe for the same SKUs.
- Premature “crypto” language in UI/copy that creates regulatory exposure.

---

## 7. Success picture (12–36 months, directional)

**Near term:** Every Apixis company shows Wallet; cash→Ixis→redeem works; books reconcile.

**Mid term:** Most family plan commerce is Ixis-only; teams and agents spend through one bank.

**Long term (post-legal):** Ixis is recognizable as **the Apixis currency** — still the unit inside products, and *also* portable on **our** chain under rules counsel approved — without fracturing the family into a dozen private coins.

---

## 8. Document control

| Field | Value |
|-------|--------|
| Created | 2026-09-21 |
| Authoring | Developer Bot hub from Awad’s locked rules + existing `VISION.md` |
| Canonical repo path (target) | `docs/WALLET_VISION_DETAILED.md` in `313aidaroos/ApixisWallet` |
| Supersedes | Nothing — expands short `VISION.md` |
| Next review | After buy-UX + embed PR merges; again before any Phase 5 engineering spike |

**Awad decides.** Leads paint. Hub wires. Counsel opens Phase 5 — or it stays closed-loop forever if that is safer. Either way, Phase 1–4 remain valuable commerce infrastructure on their own.
