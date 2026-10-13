# Apixis Wallet: launch notes

_Updated 2026-09-27. One notes file per repo: what was changed, file by file, and everything you need to connect. The full family report: https://claude.ai/artifact/QERxA6PMsFK1vdR51Ex2NQ_

## Status

Live bank for the whole family. Ready: set keys and run `npm run family-keys -- --only <new sites>` (never for a site that already has a key).

## Connect (in order)

1. Supabase (Wallet project): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Stripe (the only place payments are taken): `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IXIS_*_PRICE_ID`. Webhook URL: `https://apixis-wallet.vercel.app/api/webhooks/stripe` (not `/api/stripe/webhook`, which 404s). Events: see **Stripe webhook and payment methods** below.
3. `WALLET_STATS_KEY`: same random value as on COMMAND (read-only graph).
4. Then run `npm run family-keys -- --only <new sites>` and hand each site its block (see each repo's LAUNCH_NOTES).

Every key this repo reads is listed in `.env.example` (required, optional, and legacy names to leave unset).

## Stripe webhook and payment methods

**Webhook endpoint:** `https://apixis-wallet.vercel.app/api/webhooks/stripe` (add one per custom domain if the Wallet moves). Stripe Dashboard → Developers → Webhooks. Tick exactly these events:

| Event | What the Wallet does |
|---|---|
| `checkout.session.completed` | Credits the pack if `payment_status` is `paid` (cards, Apple Pay, Google Pay, Link, Cash App Pay). If it is still `unpaid` (a delayed method), nothing is credited yet. |
| `checkout.session.async_payment_succeeded` | Credits the pack for a delayed payment that has now succeeded (session is `paid`). |
| `checkout.session.async_payment_failed` | Delayed payment failed: nothing credited, nothing to reverse. Logged only. |
| `charge.refunded` | Full refund reverses the pack (partial refunds are not applied). |
| `charge.dispute.closed` | A lost dispute reverses the pack; won disputes change nothing. |

Credit is idempotent on the Stripe event id (`credit_xp` `external_id`) and the audit row on `purchase:<event id>`. Stripe only sends `async_payment_succeeded` for a session whose `completed` event was unpaid, so each session is credited once.

**Payment methods come from the Dashboard.** Buy Ixis uses Stripe-hosted Checkout (`checkout.sessions.create`, redirect to `session.url`) with no `payment_method_types`, so Stripe shows every method enabled in Dashboard → Settings → Payment methods that the buyer is eligible for. Turn methods on or off there; no deploy needed. Enable:

- Cards
- Apple Pay (hosted Checkout: no domain registration needed)
- Google Pay
- Link
- Cash App Pay (USD only, US Stripe accounts; best under ~$2,000 per order because of Cash App customer limits)
- Stablecoins and Crypto (USDC and others; request access, Stripe reviews it and extra terms may apply; US businesses except New York; USD prices only; up to $10,000 per payment; no disputes; refunds go back as stablecoins)

Every `STRIPE_IXIS_*_PRICE_ID` must be a **USD** price or Cash App Pay and crypto will not show.

Apple Pay domain registration (Dashboard → Settings → Payment method domains) is only needed if the Wallet ever switches to embedded Checkout, Payment Element or Express Checkout Element. Then register `apixis-wallet.vercel.app` and every custom domain that shows the button.

## Apixis Wallet

This IS the Wallet. `lib/catalog.ts` lists every product a site can sell; `scripts/create-family-keys.ts` lists every site that gets a key. A site product that is not in the catalog is refused (404).

## Database

No pending changes.

## Open items

- AwadBot is not in `create-family-keys.ts` or the catalog on purpose: AwadBot does not deliver anything yet (see AwadBot notes). Add both when it does.
- Socixis avatar base and site packs (and the two `shop.template.site.*` Shop rows) are free since 2026-10-04 (`freeCatalog`, not quotable). Paid avatar renders `socixis.avatar.render.45s` 1,500 / `.60s` 2,000 / `.90s` 3,000 / `.120s` 4,000 Ixis are redeemable (free videos capped at 30s, no paid 30s SKU); Socixis keeps them locked until it wires reserve/capture/release.

## What changed, file by file

### 2026-10-04: Socixis Content Studio image SKU (Wallet Lead, approved Socixis freeze exception, 10:45 PM CT)

| File | Change |
|---|---|
| `lib/catalog.ts` | Added `socixis.image.generate` (25 Ixis, consumable) to `redeemCatalog`, matching Socixis PR #67 (`redeem()` → reserve/capture/release on that key). |
| `test/held-catalog.test.ts` | New SKU at 25 Ixis, app Socixis, no `days`. |
| `docs/INTEGRATION.md` | Table row. |

### 2026-10-04 (follow-up): 45s and 60s avatar render SKUs (Grok, Awad scope update 4:38 PM CT)

| File | Change |
|---|---|
| `lib/catalog.ts` | Added `socixis.avatar.render.45s` (1,500) and `socixis.avatar.render.60s` (2,000). Free avatar videos capped at 30s (Socixis-side); no paid 30s SKU. |
| `test/held-catalog.test.ts` | All four render tiers; no `.30s` SKU. |
| `docs/INTEGRATION.md` | Table rows. |

### 2026-10-04: Socixis avatar render SKUs + free site packs / avatar base (Grok, Socixis request, Awad approved)

| File | Change |
|---|---|
| `lib/catalog.ts` | Added `socixis.avatar.render.90s` (3,000) and `socixis.avatar.render.120s` (4,000) to `redeemCatalog`. `heldCatalog` replaced by `freeCatalog` (price 0, not quotable): avatar base, 6 `socixis.site.*` packs, and `shop.template.site.saas` / `.shop` (removed from `shopCatalog`). |
| `test/held-catalog.test.ts` | Covers the new SKUs, the free list and that free items can't be quoted. |
| `docs/INTEGRATION.md`, `docs/LAUNCH_NOTES.md` | Catalog tables updated. |

### 2026-09-27: dashboard-driven payment methods + async credit

| File | Change |
|---|---|
| `app/api/checkout/route.ts` | Comment only. Checkout already sends no `payment_method_types`, so methods come from the Dashboard. |
| `app/api/webhooks/stripe/route.ts` | Explicit `checkout.session.async_payment_failed` handling (no credit). Credit path unchanged: only a `paid` session credits, on `completed` or `async_payment_succeeded`. |
| `test/checkout-payment-methods.test.ts` | New. No hardcoded payment methods; async success credits once; unpaid and failed sessions never credit. |
| `docs/LAUNCH_NOTES.md`, `docs/BUILD_AND_LAUNCH.md`, `docs/KEYS.md`, `docs/LAUNCH_KEYS.md`, `AGENTS.md` | Webhook URL fixed to `/api/webhooks/stripe`; full event list; payment method checklist. |

### 2026-09-25

Each changed backend code file also starts with a one-line `Change note (Claude, Sep 2026)` comment saying the same thing.

| File | Change |
|---|---|
| `.env.example` | Added `WALLET_STATS_KEY`; today added every key the code reads that was missing. |
| `AGENTS.md` | Documented the summary endpoint. |
| `README.md` | Documented the summary endpoint. |
| `app/api/v1/admin/summary/route.ts` | New. `GET /api/v1/admin/summary`, guarded by `WALLET_STATS_KEY`. Cannot move money. |
| `docs/LAUNCH_NOTES.md` | This file. |
| `lib/admin-summary.ts` | New. Read-only totals (sales, daily cash, per-app) for COMMAND's graph. |
| `lib/catalog.ts` | Socixis avatar base and 6 site packs held in `heldCatalog` (not for sale). The 6 skins and the all-skins pack sell again now that Socixis checks them. |
| `test/admin-summary.test.ts` | New. Tests for the summary math and the key check. |
| `test/held-catalog.test.ts` | New. Held products are refused; Autopilot, skins and the all-skins pack sell. |

**Removed:** `Apixis_Wallet_MVP_GitHub_Ready.zip`: stale copy of the app already on main.

_Changes are backend and plumbing only. Pages, design and UI are not changed except where noted as a build or lint fix with no visual change._

## 2026-10-13 — monthly catalog SKUs (Wallet Lead, Awad approved 12:15 PM CT)

| Product Key | App | Name | Ixis | USD |
|---|---|---|---|---|
| `renoxis.agent.monthly.10000` | Renoxis | Renoxis Monthly (post-intro) | 10,000 | $100/mo |
| `contraxis.plan_a.monthly` | Contraxis | Contraxis Pro | 9,900 | $99/mo |
| `contraxis.plan_b.monthly` | Contraxis | Contraxis Business | 39,900 | $399/mo |

All 30-day monthly seats, no aliases. `renoxis.agent.monthly` (5,000 Ixis) is unchanged.

## 2026-10-13 — Lyrixis voice and Socixis plan SKUs (Wallet Lead, Awad approved 1:41 PM CT)

| Product Key | App | Name | Ixis | USD |
|---|---|---|---|---|
| `lyrixis.voice.setup` | Lyrixis | Voice setup | 500 | $5 |
| `lyrixis.voice.song` | Lyrixis | Voice song | 600 | $6/song |
| `lyrixis.voice.take` | Lyrixis | Extra take | 100 | $1 |
| `lyrixis.voice.release` | Lyrixis | Release to streaming | 900 | $9 |
| `lyrixis.all_access.monthly` | Lyrixis | All-Access | 3,000 | $30/mo |
| `socixis.creator.monthly` | Socixis | Creator | 5,000 | $50/mo |
| `socixis.small_business.monthly` | Socixis | Small Business | 30,000 | $300/mo |

`lyrixis.all_access.monthly`, `socixis.creator.monthly`, and `socixis.small_business.monthly` are 30-day seats. The four Lyrixis voice rows are one-time (no `days`). All-Access includes "Voice model + 4 songs + 1 release/mo". No aliases. `lyrixis.track.unlock` (300 Ixis) and `socixis.autopilot.monthly` (45,000 Ixis) are unchanged.
