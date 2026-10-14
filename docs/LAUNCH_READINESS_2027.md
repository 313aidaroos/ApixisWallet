# Launch readiness — 1 January 2027

Point in time: **14 October 2026**, after #64 landed on `main` (`2654d9b`). Production is [https://apixis-wallet.vercel.app](https://apixis-wallet.vercel.app). A beta is already running. This file is the launch board for that date. The changes from #65, #66, #67, #68, and #69 are combined on this draft (`cursor/launch-combined-e71a`). Those pull requests are closed in favor of this one. Do not merge until Awad approves.

Rules that stay in force: one ledger, peg **100 Ixis = $1**, no cash-out, signup is an Apixis ID, card payments go through this Wallet’s Stripe (Qahwah coffee and Pinixis are the approved exceptions), prices live in `lib/catalog.ts`.

## Done on `main`

- Money moves only through the SQL functions (`credit_xp`, `reserve_xp`, `capture_xp`, `release_xp`, `refund_xp`, welcome grant, marketplace settle). Ledger is append-only and must balance.
- Migrations through **014** are the live set called out in `AGENTS.md` (007 and 008 verified 2026-09-23; later family migrations are recorded in `docs/FAMILY_STATUS.md`). **015 and 016 are in this draft and are not applied to the live database.**
- Stripe Checkout sells Ixis packs. The webhook credits a paid session once, keyed by the Stripe event id. Full refunds and lost disputes debit paid Ixis. Partial refunds are logged and not applied.
- Sister sites spend Ixis with reserve then capture. The Wallet UI redeems in one step. Catalog redeems do not take a platform fee.
- Marketplace and world-trade settle default to **500 bps (5%)**. World trades are already locked at 500. `world_purchase` sends the whole amount to clearing (a sink, not a 5% seller fee).
- Apixis ID: `/sso/authorize`, `/api/sso/token`, SDK v3. Wallet `/login` is how a person creates that ID.
- Welcome grant (1,000 bonus Ixis, once per Apixis ID) is behind `SIGNUP_GRANT_ENABLED`. Do not flip it from a pull request.
- Legal record: `audit_events`, master-only export at `/api/admin/audit`.
- Per-site API keys exist. A read-only check of `wallet_api_clients` on 2026-10-14 found an **active row for every family site in `scripts/family-sites.ts`, plus Pinixis**. The “missing for most sites” gap is not true. Every row seen had `require_sso = false`. Key material is not copied into this file.
- Holds expire (lazy release plus `/api/cron/release-holds`).

## Gaps checked on 14 October 2026

| Gap | What is true | Where it stands |
|---|---|---|
| No `/terms`, `/privacy`, or `/refund` | Production returned 404 for all three at audit time. Counsel drafts already live under `docs/legal/`. | Merged as [#64](https://github.com/313aidaroos/ApixisWallet/pull/64) (`2654d9b`). Pages are marked **DRAFT — pending counsel**. `TERMS_VERSION` is not bumped. |
| 5% fee only on marketplace and world orders | Catalog redeem and capture never took a fee. World trades were already locked at 500 bps. A plain marketplace settle still accepted `feeBps` 0 or 800. | In this draft (from [#65](https://github.com/313aidaroos/ApixisWallet/pull/65)). Marketplace `feeBps` other than 500 is rejected. Tips of 10–19 Ixis still floor to a 0 fee. |
| `/buy/complete` stalls; `async_payment_failed` stays pending | A complete unpaid session was treated as pending until the poll gave up, including after a failed delayed payment. | In this draft (from [#66](https://github.com/313aidaroos/ApixisWallet/pull/66)). Failed vs still-processing vs waiting on the ledger. Migration 015 is an audit-type check only. It does not move Ixis. |
| Monthly auto-renew | Not on `main`. A redeem of a monthly SKU grants 30 days and stops. | In this draft (from [#68](https://github.com/313aidaroos/ApixisWallet/pull/68)). Customer chooses card (Stripe subscription, catalog price) or Ixis (cron reserve + capture). |
| `lib/checkout/return-url.ts` mentions Geoxis | Both hosts are live: `geoxis.vercel.app` (title “Geoxis”, HTTP 200) and `spatial-dashboard-xi.vercel.app` (title “Geoxis — Live globe”, HTTP 200). `recovix-dev.vercel.app` was listed twice. `recovra-three.vercel.app` is HTTP 404. | In this draft (from [#67](https://github.com/313aidaroos/ApixisWallet/pull/67)). Both Geoxis hosts stay. The duplicate Recovix line is gone. The 404 host is not added. |
| `wallet_api_clients` missing | Not missing. See above. | No code change. Recovix’s stored redirect URI still points at `https://recovra-three.vercel.app/auth/apixis/callback` (404). That row was not edited. |
| Recovix merges into Deduxis | Not done. Different prices (`recovix.intel.monthly` 22,000 and `recovix.intel.growth` 44,000 vs `deduxis.receipts.monthly` 15,000), separate Supabase projects, separate API client, and `https://recovix-dev.vercel.app` is live (HTTP 200). | Blocker for Awad. No catalog or company-card change. |

## This draft (do not merge)

[#64](https://github.com/313aidaroos/ApixisWallet/pull/64) (draft `/terms`, `/privacy`, and `/refund` pages, plus footer links) is on `main`. The pages stay DRAFT until counsel signs them.

#65, #66, #67, #68, and #69 are closed. Their changes are this draft:

| Was | Summary |
|---|---|
| [#65](https://github.com/313aidaroos/ApixisWallet/pull/65) | Marketplace settle cannot override the 5% fee. |
| [#66](https://github.com/313aidaroos/ApixisWallet/pull/66) | Failed and still-processing states on `/buy/complete`. |
| [#67](https://github.com/313aidaroos/ApixisWallet/pull/67) | Keep both live Geoxis return hosts; drop the duplicate Recovix host. |
| [#68](https://github.com/313aidaroos/ApixisWallet/pull/68) | Monthly seats renew from a card or the Ixis balance. |
| [#69](https://github.com/313aidaroos/ApixisWallet/pull/69) | This launch board. |

Existing PR [#59](https://github.com/313aidaroos/ApixisWallet/pull/59) (AI Receptionist SKU) is still the held catalog change. It is **not** part of this pass. `apixis.receptionist.monthly` is not in `lib/catalog.ts`. Do not merge #59 until the engine review in `docs/AI_RECEPTIONIST.md` is done.

## Still open — needs Awad, env, DNS, or Stripe

These were not changed from this pass.

1. **Apply migrations** `015_checkout_payment_failed.sql` and `016_monthly_subscriptions.sql` on the Wallet database (`kzneeksminozmhnqaaun`). They are in this draft and are not applied from the pull request. Until 016 is applied, enroll and renew fail. Until 015 is applied, the failed-payment audit insert is skipped; the page still uses the PaymentIntent status.
2. **Stripe webhook events to add** (Dashboard, not this repo): `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Keep the events already required for packs, including `checkout.session.async_payment_failed`.
3. **Stripe restricted key**: Subscriptions write, or a card seat’s “Stop next renewal” returns 502 and the card keeps charging. Pack checkout still needs Checkout Sessions write plus PaymentIntents and Charges read.
4. **`CRON_SECRET`** must be set in Vercel production. Release-holds already depends on it. The new Ixis renewal cron returns 503 without it. `vercel.json` only adds the path; it does not set the secret.
5. **`TERMS_VERSION`**, the Stripe Terms of Service URL, and `STRIPE_REQUIRE_TERMS` stay unset until counsel signs the draft pages. Do not turn on numbered Stripe invoices from a pull request.
6. **Recovix Apixis ID redirect** in `wallet_api_clients` points at `recovra-three.vercel.app`, which 404s. The live site is `recovix-dev.vercel.app`. Fix the row when Awad says which host is the sign-in callback. Do not point return URLs at the 404 host.
7. **Recovix → Deduxis** is a product and data decision (prices, two Supabase projects, two client rows, a live Recovix site). Not a safe code merge.
8. **Counsel** must review the draft terms, privacy, and refund pages (EU/UK withdrawal, US gift-card rules) before they stop saying DRAFT.
9. **`require_sso` is still false** on the API clients, and the legacy service key is still accepted until `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`.
10. **Supabase Auth**: leaked-password protection and email confirmation stay a dashboard task (`AGENTS.md` §8).
11. **30-day SKUs that are not named monthly** do not auto-renew: Geoxis tracking, Rawixis seats, `recovix.intel.growth`, `contraxis.seat.*`, `rawixis.featured.listing`. Say if those should renew too.
12. **Receptionist SKU** (`apixis.receptionist.monthly`, 10,000 Ixis, 30 days, app Family) is specified in D18 and is not in the catalog.

## Left as they are

- Theme. The running Wallet is Cyber Design 02 (DM Sans, Space Grotesk, Libre Caslon), not Inter. No font change in this pass.
- Signup stays “Create your Apixis ID” on `/login`.
- No manual mints. No env, DNS, or Stripe Dashboard edits.
- Bonus expiry is still not enforced. Partial refunds are still not applied to the ledger. There is still no owner admin dashboard and no low-balance notice.
- Rate limits are still in-memory per instance.

## Undo

This file is notes. Revert this draft to remove the board and the combined changes. Each original change still has its own `NOTES/GROK.md` entry and undo line.
