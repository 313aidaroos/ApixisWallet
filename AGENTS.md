# AGENTS.md — read this first

For every bot and developer working on **Apixis Wallet** (Claude, Grok, Cursor, Hermes, Developer Bot, humans).
If anything here disagrees with an older doc (`GROK_MASTER_PROMPT.md`, `docs/BUILD_AND_LAUNCH.md`, `docs/RENOXIS.md`), **this file wins**.
Last updated: 2026-09-23 (launch hardening 007, legal record 008, SDK v2).

**New session? Start with §0: it has the owner's decisions and exactly where work stopped.**

---

## 0. Owner decisions and where work stopped (keep this current)

**Decisions by Awad (2026-09-23). Do not change them without asking.**

| # | Decision | What it means in code |
|---|---|---|
| D1 | **Ixis never expire.** | `paid` Ixis has no expiry anywhere. Don't add one. |
| D2 | **Monthly seats last 30 days.** Ixis doesn't expire; the *access bought* does. | Catalog rows with `days: 30` → `entitlements.renews_at` = capture + 30 days, stacking. One-time unlocks never end. |
| D3 | **No refunds. All Ixis sales are final.** Someone who bought 10,000 and spent 8,000 keeps the 2,000 to spend; there is no cash back. | Checkout shows `FINAL_SALE_NOTICE` (`lib/checkout/policy.ts`). Stripe refunds are *not* issued. If one is issued anyway, or a chargeback is lost (the bank forces it), the webhook removes the Ixis (`refund_xp`, balance may go negative). Counsel should confirm the terms wording (EU/UK withdrawal rights, US state gift-card rules). |
| D4 | **One shared Apixis login across every platform (Apixis ID).** | Not built yet; next project, see "Next steps". |
| D5 | **Keep a legal record of every transaction:** time, date, site, transaction id, invoice/receipt, IP. | Migration 008 `audit_events` plus the routes below (§4b). Export: `/api/admin/audit`. |
| D6 | Awad owns design/UI; the backend lead owns backend/plumbing (§1). | |

**Status (2026-09-23):**
- Backend code is complete and tested on branch `claude/epic-rubin-oen8nu`.
- **Migrations 007 + 008 are APPLIED on live** (Supabase project `apixis-wallet`, ref `kzneeksminozmhnqaaun`).
  - Verified after applying: 0 money functions open to anon/authenticated, `audit_events` hidden from customers, append-only triggers active, all transactions balanced.
  - A rolled-back live dry run passed: credit → reserve → capture → 30-day seat → release-after-capture = WA409 → refund debits.
- **Before 007 was applied:** the ledger held only test/QA data (57 rows, all `@apixis.dev` accounts: ledger-test, e2e, victim/attack security tests, `awad+<site>` QA). No real customers, no real Stripe purchases, no sign of abuse of the open functions. Awad chose to **keep** the test rows (they're now permanent). Three test holds get released automatically by expiry.
- Audit reference numbering starts at APX-00000002: APX-00000001 was used by the rolled-back dry run, because sequences don't roll back.

**Next steps, in order:**
1. **Merge `claude/epic-rubin-oen8nu` → `main`** (safe now that 007/008 are live). In Vercel, set `CRON_SECRET` and `TERMS_VERSION`, then redeploy.
2. **Supabase Auth settings** (dashboard): turn on leaked-password protection (Authentication → Policies/Passwords) and keep email confirmation ON.
3. **Apixis ID (D4).** Design one shared login:
   - The Wallet Supabase project becomes the identity provider.
   - Sister sites use "Sign in with Apixis".
   - The Wallet verifies Apixis ID tokens instead of trusting `owner_email`.
   - Needs access to the sister-site repos, plus Awad's answer on moving sites to `*.apixis.dev` subdomains. Every sister site has its own Supabase project in the same org (renoxis, Socixis, Lyrixis, recovra, deduxis, rawixis, geoxis, nurserytoons, launchixis, halaxis, Contraxis).
4. Per-site API keys for each sister site, then `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` and rotate the Supabase secret.

## 1. Who owns what

| Area | Owner | Files |
|---|---|---|
| **Design / UI** | Awad | `components/**`, `app/**/page.tsx`, `app/layout.tsx`, `app/globals.css`, copy, `lib/news.ts`, `lib/market.ts` (demo tape) |
| **Backend / plumbing / money** | Claude (backend lead) | `supabase/**`, `app/api/**`, `lib/api/**`, `lib/stripe/**`, `lib/supabase/**`, `lib/checkout/**`, `lib/catalog.ts` (prices), `sdk/**`, `scripts/**`, `test/**`, `.github/**`, `vercel.json` |

- **Design bots:** do not edit backend files. To show real data in the UI, use `lib/wallet-client.ts` (§6). If you need an endpoint that doesn't exist, ask. Don't write a new one.
- **Backend bots:** do not restyle UI. Wiring a component to real data is fine if the change is data-only.
- **Prices and SKUs** live only in `lib/catalog.ts`. Awad approves every new SKU or price change.

## 2. What this app is

The one cash register and ledger for the Apixis family. **100 Ixis = $1.**
- People pay dollars **only here** (Stripe Checkout) and get Ixis.
- They spend Ixis ("redeem") on SKUs of sister sites: Renoxis, Socixis, Recovra, Rawixis, Contraxis, Qahwahworld, Geoxis, Launchixis, Nursery Toons, Lyrixis, Apixis.dev and others.
- Closed loop: no cash-out, no transfers between people, no investment language, no chain (Phase 5, legal-gated). See `POLICY.md`.

## 3. Rules that must never break

1. **Never write balances directly.** All money moves through the SQL functions in §4. The ledger is append-only (triggers enforce it), and every transaction must sum to zero (a deferred trigger enforces it).
2. **Money functions are `service_role` only.** Any new `public` function needs `revoke all ... from public, anon, authenticated`. Supabase grants EXECUTE to anon by default. That is how "anyone can mint Ixis" happened before 007.
3. **Never trust the browser** for price, owner or amount. Prices come from `lib/catalog.ts` on the server. The owner comes from the session or a service key.
4. **Every reserve has an idempotency key.** Stripe credits are keyed by the Stripe event id.
5. **Sister sites never run their own Stripe for plans or Ixis,** and never keep their own Ixis balance.
6. **A captured hold means the customer was charged.** Never take access away after a capture. Only a *released* hold means "not charged".
7. **Secrets are server-only:** `SUPABASE_SECRET_KEY`, `STRIPE_*`, `CRON_SECRET` and API keys. Never log them, and never put them in `NEXT_PUBLIC_*`.
8. **Ship a SQL test with any SQL change** (`supabase/tests/`). Run `npm run check` and `npm run test:sql` before pushing.

## 4. How money moves

```
BUY    browser → POST /api/checkout (signed in) → Stripe Checkout
       Stripe → POST /api/webhooks/stripe → credit_xp(paid, key = event.id)
       browser → /buy/complete polls /api/checkout/status → optional 302 to allowlisted return_url

REDEEM (sister site server, SDK redeem())
       reserve_xp  → hold (available −X, held +X), expires in 30 min
       site provisions access
       capture_xp  → spend (held −X), writes entitlements row (renews_at for timed SKUs)
       or release_xp → hold returned to the bucket it came from (paid/bonus)

REDEEM (inside Wallet UI)  POST /api/v1/redeem → reserve + capture in one step

REFUND  Stripe charge.refunded (full) or charge.dispute.closed (lost)
        → refund_xp: customer paid −X (can go negative if already spent), once per charge
```

**Ledger buckets:**
- `paid`: bought with cash, never expires.
- `bonus`: promotional. It is spent first. Expiry is **not** enforced yet, so don't issue expiring bonus.
- `reserved`: held.
- `clearing`: the system counter-wallet, owner `00000000-…`.
- **Available** = `paid` + `bonus`.

**SQL functions** (all `SECURITY DEFINER`, `service_role` only, defined in `supabase/migrations/007_launch_hardening.sql`):

| Function | Purpose |
|---|---|
| `credit_xp(owner, amount, bucket, desc, external_id, app, expires_at)` | Stripe purchase / bonus. Idempotent on `external_id`. |
| `refund_xp(owner, amount, desc, external_id, app)` | Reverse a cash purchase (refund / lost dispute). Debits the customer. |
| `reserve_xp(owner, amount, desc, external_id, app, product_key, actor, entitlement_days, hold_seconds)` | Locks the wallet row. A replay must match owner + product + amount, otherwise `WA409`. Frees expired holds first. |
| `capture_xp(reservation_id, desc, actor, allowed_apps)` | Idempotent. A released hold gives `WA409`. Upserts the entitlement. |
| `release_xp(reservation_id, desc, actor, allowed_apps)` | Idempotent. A captured hold gives `WA409` (`already_captured`). |
| `release_expired_holds(limit)` | Cron sweep. |
| `wallet_history(owner, limit, offset)` | One row per transaction, with the change to available and held. |
| `get_or_create_wallet`, `find_user_id_by_email`, `release_hold_internal` | Helpers. |

### 4b. Legal record: `public.audit_events` (migration 008)

The ledger is the accounting truth. `audit_events` is the evidence around it.
- **Append-only**, `service_role` only, never deleted.
- Every row gets a sequential **reference** `APX-00000001`.
- Written by `recordAudit()` in `lib/audit.ts`.

| Event | Written by | Key fields |
|---|---|---|
| `checkout_started` | `POST /api/checkout` | user, email, pack, price shown (cents), Stripe session, terms version, IP, user agent |
| `purchase` | webhook (**required**: 500 + Stripe retry if it can't be written) | Stripe event / session / payment intent / charge / invoice ids, receipt URL, amount + currency, tax, country, ledger tx |
| `refund`, `dispute_lost` | webhook (required) | charge, amount, reason, ledger tx |
| `reserve`, `capture`, `release` | `/api/v1/reservations*` (best effort; the ledger row exists regardless) | site/actor (`key:renoxis`), app, email, product, Ixis, reservation id, IP, and rejected attempts too |
| `redeem` | `POST /api/v1/redeem` | user, email, product, Ixis, IP |
| `hold_expiry_sweep` | cron | count released |

- **Export (master account only, confirmed email = `ALLOWED_EMAIL`):**
  `GET /api/admin/audit?from=2026-09-01&to=2026-10-01&type=purchase&email=…&app=…&format=csv` (10,000 rows per page; page with `before_id`).
- **Invoices:**
  - Stripe email receipts are free: turn on Stripe → Settings → Customer emails → Successful payments. Receipt URLs are stored either way.
  - Real numbered Stripe invoices (PDF): set `STRIPE_CREATE_INVOICES=true`. Stripe charges a per-invoice fee.
  - Terms checkbox at checkout: set `STRIPE_REQUIRE_TERMS=true` after a Terms URL is set in Stripe → Settings → Public details.
  - Set `TERMS_VERSION` (e.g. `2026-09-23`) and bump it whenever the terms page changes.
- **Privacy:** IP addresses and emails are personal data. The privacy policy must say they are kept for fraud, tax and legal purposes.

**Error SQLSTATEs → HTTP** (`lib/api/errors.ts`):

| SQLSTATE | HTTP |
|---|---|
| `WA400` | 400 |
| `WA402` | 402 (insufficient) |
| `WA404` | 404 |
| `WA409` | 409 (`already_captured` / `already_released` / `conflict`) |
| `WA403` | append-only violation |
| `WA500` | unbalanced transaction |

## 5. HTTP API

Base URL: `https://apixis-wallet.vercel.app`. Contract detail and curl examples: `docs/INTEGRATION.md`.

| Route | Auth | Notes |
|---|---|---|
| `POST /api/checkout` | Wallet session cookie | `{ packId: spark\|agent\|office\|business, return_url?, product? }` → `{ url }` |
| `GET /api/checkout/status?session_id=` | cookie | Success-page polling |
| `GET /api/checkout/return?session_id=` | cookie | 302 to the stored, allowlisted return_url |
| `POST /api/webhooks/stripe` | Stripe signature | Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.closed` |
| `POST /api/v1/quotes` | public | Price from the catalog. Informational: reserve re-reads the catalog. |
| `POST /api/v1/reservations` | service key | `{ productKey, idempotencyKey (8–80 printable, no spaces), owner_email }` → 201 `{ reservationId, status:"held", app, ixis }` · 402 · 403 (key can't use that app) · 409 (key reused differently) |
| `GET /api/v1/reservations/:id` | service key | `{ status: held\|expired\|captured\|released, receiptId, … }`. Use it to reconcile. |
| `POST /api/v1/reservations/:id/capture` | service key | Idempotent · 409 `already_released` |
| `POST /api/v1/reservations/:id/release` | service key | Idempotent · 409 `already_captured` (keep access) |
| `GET /api/v1/entitlements?app=&owner_email=` | service key, or Wallet user | Active rows only (`renews_at` null or in the future). A per-site key only sees its own apps. |
| `GET /api/v1/wallet` | Wallet user (cookie or `Bearer <Wallet access token>`) | `{ available, paid, bonus, reserved, usd, rate }` |
| `GET /api/v1/ledger?limit&offset` | Wallet user | `{ transactions: [{ kind, description, app, productKey, amount, held, createdAt }], total }` |
| `POST /api/v1/redeem` | Wallet cookie, same-origin JSON | `{ productKey, idempotencyKey }` → reserve + capture |
| `GET /api/cron/release-holds` | `Bearer $CRON_SECRET` | Daily via `vercel.json`. Holds are also freed lazily on the next reserve. |
| `GET /api/admin/audit` | master account session | Legal/accounting export (§4b), JSON or `format=csv` |
| `GET /api/v1/admin/summary?days=30` | `Bearer $WALLET_STATS_KEY` (read-only, ≥32 chars) | Owner business summary for AWAD COMMAND: daily cash in / refunds / Ixis sold / Ixis redeemed, redemptions by site, customer holdings, active entitlements, last 25 events (no IP / user agent). 503 until the key is set. Not a money key. |

**Service auth** (`lib/api/service-auth.ts`):
- **Per-site keys (preferred):** `apx_live_…`, stored hashed in `public.wallet_api_clients` and scoped to `app_slugs`.
  - Create one: `npm run api-key -- --name renoxis --apps renoxis`.
  - Revoke one: `update public.wallet_api_clients set active=false, revoked_at=now() where name='renoxis'`.
- **Legacy:** the Wallet's `SUPABASE_SECRET_KEY` used as the bearer. It is unscoped and accepted until `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`.
- The ledger namespaces idempotency keys by app (`renoxis:<key>`), so two sites can't collide.

**App slugs:** there is one canonical slug per app, from `canonicalAppSlug()` in `lib/checkout/destinations.ts`. Examples: `renoxis`, `socixis`, `contentbot` (not `personalcontentbot`), `apixis` (not `apixis.dev`), `nurserytoons`, `qahwahworld`.

**Entitlement periods:** a catalog row with `days: 30` means capture sets `renews_at = now + 30 days`. A renewal while the period is still active stacks another 30 days. No `days` means a one-time unlock, `renews_at = null`, forever. For consumables (clips, RFQ packs, exports), use the capture receipt, not the entitlement.

## 6. For the design side: real data in the UI

`lib/wallet-client.ts` is browser-safe and data-only:

```ts
import { fetchBalance, fetchHistory, redeemProduct, WalletClientError } from "@/lib/wallet-client";
const b = await fetchBalance();                    // throws WalletClientError; .needsSignIn on 401
const h = await fetchHistory({ limit: 20 });
const r = await redeemProduct("renoxis.agent.monthly"); // { ok } | { ok:false, reason:"signin"|"insufficient"|… }
```

**Still demo in the UI (Awad's side, must change before launch):**
- `components/WalletScreen.tsx` has a hard-coded balance (`40350`), seed history, and a local-only Redeem/Shop that never touches the ledger.
- The "● LIVE" badge sits on top of that demo data.
- The Tape/Market tab shows "Cap", "24h vol" and ticker symbols. That reads like an investment, which `POLICY.md` forbids. Relabel it or remove it for launch.
- The redeem button needs its own `idempotencyKey` per click (the helper creates one), and the balance should be re-fetched after a redeem.

## 7. Database and migrations

- **Order:** `supabase/migrations/001` → `008`. Apply in order in the Wallet Supabase project (SQL editor or `supabase db push`). **007 and 008 are safe to re-run.** Apply them before deploying code that needs them (§0).
- **Tables** (in `public`, not moved to a `wallet` schema yet): `wallets`, `ledger_transactions`, `ledger_entries`, `entitlements`, `wallet_api_clients`, `audit_events`, plus the view `wallet_balances`.
- **Customers** (`authenticated`) have SELECT-only access through row-level security on their own rows. `anon` has nothing.
- **Tests:** `npm run test:sql` runs every migration plus `supabase/tests/*.sql` on a throwaway Postgres (set `PGHOST`, `PGUSER`, `PGPASSWORD`), including a 20-way concurrency test. **Never point it at production.** `supabase/tests/00_supabase_stub.sql` fakes the Supabase roles and grants for local and CI runs only.

## 8. Launch checklist

**Backend (done in code on this branch):**
- [x] Money functions locked to `service_role` (007).
- [x] Refund and lost dispute reverse the purchase (007 + webhook).
- [x] No overdraw under concurrency (row lock + test).
- [x] Release-after-capture refused; SDK v2 never removes access from a charged customer.
- [x] Idempotency scoped by app and verified on replay.
- [x] Holds expire (lazy + daily cron).
- [x] Monthly entitlements expire and stack.
- [x] Append-only, always-balanced ledger.
- [x] Per-site scoped API keys.
- [x] Real balance, history and redeem endpoints.
- [x] Append-only legal record of every money event, with a master-only CSV export (008).
- [x] Final-sale notice on Stripe Checkout; optional terms checkbox and Stripe invoices.
- [x] CI: lint, typecheck, unit tests, build, SQL tests.

**Ops (Awad / whoever holds the keys):**
1. [x] **Apply `007_launch_hardening.sql` and `008_audit_log.sql`** to the live Wallet Supabase project (done 2026-09-23).
2. [x] **Verify the lock-down on live** (done: 0 rows). This must return 0 rows:
   ```sql
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('credit_xp','refund_xp','reserve_xp','capture_xp','release_xp','get_or_create_wallet','wallet_history','release_expired_holds','release_hold_internal')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
   ```
3. [x] **Audit for damage from before 007** (done: test data only, nothing to fix).
   - Any `kind='refund'` rows created before 007 *added* Ixis. They need an `adjustment`:
     ```sql
     select * from public.ledger_transactions where kind = 'refund' order by created_at;
     ```
   - Anything not made by the webhook suggests someone minted through the open RPC:
     ```sql
     select t.* from public.ledger_transactions t where t.kind in ('purchase','bonus') and (t.external_id is null or t.external_id not like 'evt_%');
     ```
4. [ ] **Vercel env:** set `CRON_SECRET` and `TERMS_VERSION`, and make sure all `STRIPE_*` and Supabase vars are set in Production. The Stripe restricted key needs Checkout Sessions (write), PaymentIntents and Charges (read), and Invoices (write, only if `STRIPE_CREATE_INVOICES=true`).
4b. [ ] **Supabase Auth:** email confirmation ON, so nobody can register an unverified `ALLOWED_EMAIL` or someone else's address.
5. [ ] **Stripe webhook events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.closed`.
6. [ ] **Per-site keys:** issue one per sister site (`npm run api-key`), put it in that site's `WALLET_API_KEY`, copy SDK v2 into each site. When all are moved, set `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` and rotate the Supabase secret key (the old one was shared with every site).
7. [ ] **Test-mode rehearsal** end to end: buy Spark → credited once → redeem → entitlement → refund → Ixis removed.
8. [ ] **Legal and product:** terms, refund policy and a privacy page live (`docs/BUILD_AND_LAUNCH.md` §6). Replace the demo UI (§6 above).

## 9. Known limits and open decisions

- **Identity is by email until Apixis ID (D4) ships.** The Wallet trusts the email a sister-site *server* sends. Any site that lets people sign up without verifying their email could let someone spend another person's Ixis. Every sister site must send only verified emails. The long-term fix is one shared Apixis ID (a single auth project) or signed identity tokens.
- **Refunds:** policy is no refunds (D3). If a full refund is issued anyway, or a chargeback is lost, the Ixis are removed even if already spent, so the balance goes negative and redeems are blocked until a top-up. Partial refunds are not applied to the ledger; they're logged for manual handling.
- **Bonus expiry** is not enforced, so don't sell or grant expiring bonus yet.
- **Quotes are informational.** A price change between quote and reserve charges the new catalog price.
- **Not built yet:**
  - rate limiting (use the Vercel WAF / firewall rules for `/api/checkout` and `/api/v1/*`)
  - an owner admin dashboard
  - low-balance notices
  - auto-renewing subscriptions (today the customer or the site redeems each month)
- **Tables are in `public`** and a move to a `wallet` schema is deferred. If this Supabase project is shared with other apps, their bots must not touch these tables.

## 10. Commands

```bash
npm run dev            # local app
npm run check          # lint + typecheck + unit tests + build
npm run test:sql       # ledger SQL tests (needs a local Postgres; PGHOST/PGUSER/PGPASSWORD)
npm run api-key -- --name <site> --apps <app>[,<app>] [--test]
```
