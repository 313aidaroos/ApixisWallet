# Apixis Family: engineering update for all bots and agents (2026-09-23)

> Rollout update (2026-09-25): migration `009_apixis_id` is now applied to the live Wallet database. The PR conflict with the owner-summary API documentation is resolved with both endpoint groups preserved. Wallet #7 and Renoxis #18 are being validated for merge; older pending-migration notes below are historical.

**From:** Claude, lead developer for the Apixis family (appointed by Awad, owner).
**To:** every bot or agent working on any Apixis repo (Grok, Cursor, Hermes, Developer Bot, Codex, other Claude sessions, humans).
**Status:** authoritative as of 2026-09-23. If this conflicts with an older doc, prompt or memory, this wins. After this, the live source of truth is **`ApixisWallet/AGENTS.md`**; keep it updated when you change something.

Read all of it before touching auth, Ixis, billing, Stripe, Supabase or any `apixis-*` file in any repo.

---

## 0. TL;DR (the 12 things you must know)

1. **One economy, one balance.** Ixis (100 Ixis = $1) exists in exactly one place: the **Apixis Wallet** ledger (Supabase project `apixis-wallet`, ref `kzneeksminozmhnqaaun`). No site may store, grant or compute its own Ixis balance, and no site may run its own Stripe checkout for plans or Ixis.
2. **One login: Apixis ID.** The Wallet is the family identity provider. Every site gets "Sign in with Apixis" (`/auth/apixis/start` → Wallet → `/auth/apixis/callback`). The person's Wallet user id is the **Apixis ID `sub`**.
3. **Who pays = the `sub`.** Pass `owner: await apixisOwner(user.email)` to `redeem()`. It returns the `sub` when the person signed in with Apixis, otherwise their verified email. Never pass your site's own Supabase uid, and never take an owner from the request body.
4. **The SDK is shared, not forked.** Every site's `lib/apixis-wallet.ts` and `lib/apixis-login.ts` are copies of `ApixisWallet/sdk/apixis-wallet.ts` (**SDK v3**) and `ApixisWallet/sdk/apixis-login-next.ts`. Change them in ApixisWallet, then copy them. Don't edit them in place.
5. **A captured hold means the customer was charged.** Never remove access after a capture. Only a *released* hold means "not charged". The SDK's `redeem()` already follows this.
6. **Buy Ixis everywhere.** Every site links to the Wallet with `buyIxisUrl(app, returnUrl)`. The person buys, then comes back to the same page with the Ixis.
7. **Ledger is append-only and always balances.** Database triggers enforce it. Money only moves through the Wallet's SQL functions (service role only).
8. **Legal record.** Every checkout, purchase, refund, dispute, reserve, capture, release and redeem is written to `audit_events` with an `APX-########` reference.
9. **No refunds; Ixis never expire; monthly seats last 30 days.** These are owner decisions. Don't change them.
10. **Migrations 007 + 008 are live** on the Wallet database. **009 (Apixis ID) is NOT applied yet.** Apply it before merging ApixisWallet PR #7.
11. **13 PRs are open** (one per repo) and waiting on keys from Awad. See §7. Don't merge them out of order (see §13).
12. **Design vs backend.** Awad owns design/UI. Backend and plumbing belong to the lead developer. Don't restyle UI; don't write money code outside the patterns below.

---

## 1. Owner decisions (locked; ask Awad before changing any)

| # | Decision | What it means in code |
|---|---|---|
| D1 | **Ixis never expire.** | The `paid` bucket has no expiry anywhere. Don't add one. |
| D2 | **Monthly seats last 30 days.** The access expires, not the Ixis. | Catalog rows with `days: 30` → `entitlements.renews_at` = capture + 30 days. A renewal while active adds another 30 days. One-time unlocks have `renews_at = null` (forever). |
| D3 | **No refunds. All Ixis sales are final.** Someone who bought 10,000 and spent 8,000 keeps the 2,000; no cash back. | Checkout shows `FINAL_SALE_NOTICE` (`lib/checkout/policy.ts`). Stripe refunds are not issued. If one is issued anyway, or a chargeback is lost (bank-forced), the webhook removes the Ixis (`refund_xp`; the balance may go negative and blocks redeems until a top-up). Counsel should review the terms wording. |
| D4 | **One shared Apixis login across all platforms.** | Apixis ID (§3.2). Built in the Wallet; rolled out to 11 Next.js sites; the 3 static sites are next. |
| D5 | **Keep a legal record of every transaction:** time, date, site, transaction id, invoice/receipt, IP. | `audit_events` (§3.4), export at `/api/admin/audit`. |
| D6 | **Awad owns design/UI; the lead developer owns backend/plumbing.** | See §10 for the file ownership split. |
| D7 | **Claude is the lead developer for the whole family.** | Keep `ApixisWallet/AGENTS.md` and each site's `docs/APIXIS_FAMILY.md` current. |
| D8 | **Vision: the Apixis Family Company is its own economy.** Ixis is platform credit now, and becomes a crypto currency once compliant. | One shared ledger across every app is the foundation the future coin maps onto. The chain adapter (`lib/ixis-asset/*`) stays in `demo` mode until counsel clears it. No convert button, no investment language (`POLICY.md`). |
| D9 | **Every site has "Buy Ixis"**: Wallet → buy → back to the same site. | `buyIxisUrl(app, returnUrl)`. Every catalog app is a valid destination. The return host must be allowlisted (`lib/checkout/return-url.ts`, or `CHECKOUT_RETURN_HOSTS` for custom domains). |
| D10 | **No clones, no duplicates.** One Wallet, one SDK, one balance. | Sites carry copies of `sdk/*.ts`; no per-site ledgers or balances. |

Owner accounts: business/master email **awad@apixis.dev** (`ALLOWED_EMAIL`, the only account allowed to export the audit log). Don't put any personal email in code or docs.

---

## 2. What the Wallet is (architecture)

- **Repo:** `313aidaroos/ApixisWallet`. Next.js 16, React 19, Supabase, Stripe. Deployed on Vercel at `https://apixis-wallet.vercel.app`.
- **Database:** Supabase project `apixis-wallet` (`kzneeksminozmhnqaaun`). It's dedicated to the Wallet and not shared with other apps. Tables live in `public`.
- **Every other site has its own Supabase project** (renoxis, Socixis, Lyrixis, recovra, deduxis, rawixis, geoxis, nurserytoons, launchixis, halaxis, Contraxis; "313aidaroos's Project" holds the apixis / awad_command / qahwah / rawixis schemas). That's why identity must be the Apixis ID `sub` (or email), never a site uid.

### 2.1 Money flow
```
BUY     site "Buy Ixis" → Wallet /buy?product=<app>&return_url=<page>
        → POST /api/checkout (Wallet session) → Stripe Checkout (shows the final-sale notice)
        → Stripe webhook → credit_xp(paid, key = Stripe event id) + audit "purchase"
        → /buy/complete polls until credited → 302 back to return_url (allowlisted only)

REDEEM  site server: SDK redeem({ owner, productKey, idempotencyKey, provision, unprovision })
        → reserve_xp (hold: available −X, held +X, expires in 30 min)
        → provision() (the site grants access while the Ixis are held)
        → capture_xp (spend; writes the entitlements row; renews_at for timed SKUs)
        → or release_xp (hold returned to the bucket it came from)

IN-WALLET REDEEM  POST /api/v1/redeem (Wallet UI) → reserve + capture in one step

REFUND  Stripe charge.refunded (full) or charge.dispute.closed (lost)
        → refund_xp (customer paid −X, once per charge) + audit "refund"/"dispute_lost"
```

### 2.2 Ledger
- **Buckets:**
  - `paid`: bought with cash; never expires.
  - `bonus`: promotional, spent first. Expiry is not enforced, so don't issue expiring bonus.
  - `reserved`: held.
  - `clearing`: the system counter-wallet, owner `00000000-0000-0000-0000-000000000000`.
- **Available** = `paid` + `bonus`.
- **Tables:** `wallets`, `ledger_transactions`, `ledger_entries`, `entitlements`, `wallet_api_clients`, `audit_events`, `sso_codes`, `sso_links` (the last two need 009). View: `wallet_balances` (`available_xp`, `reserved_xp`, `paid_xp`, `bonus_xp`).
- **Invariants (triggers):** `ledger_entries` and `ledger_transactions` are append-only (UPDATE/DELETE/TRUNCATE raise `WA403`). Every transaction must sum to zero (deferred check, `WA500`). `audit_events` is append-only too.
- **SQL functions** (all `SECURITY DEFINER`, **service_role only**; anon/authenticated can't execute them):

| Function | Purpose |
|---|---|
| `credit_xp(owner, amount, bucket, desc, external_id, app, expires_at)` | Purchase or bonus. Idempotent on `external_id` (the Stripe event id). |
| `refund_xp(owner, amount, desc, external_id, app)` | Reverse a cash purchase (debits the customer; may go negative). Locks the wallet. |
| `reserve_xp(owner, amount, desc, external_id, app, product_key, actor, entitlement_days, hold_seconds=1800)` | Locks the wallet row (no overdraw), frees that wallet's expired holds, and checks the balance. A replay with the same key must match owner + product + amount, otherwise `WA409`. |
| `capture_xp(reservation_id, desc, actor, allowed_apps)` | Idempotent. Refuses a released hold (`WA409 already_released`). Upserts the entitlement (stacking `renews_at` for timed SKUs). |
| `release_xp(reservation_id, desc, actor, allowed_apps)` | Idempotent. Refuses a captured hold (`WA409 already_captured`). Returns the Ixis to their original buckets. |
| `release_expired_holds(limit)` | Cron sweep (the Wallet's `vercel.json` runs it daily). |
| `wallet_history(owner, limit, offset)` | One row per transaction with the change to available/held and a total count. |
| `consume_sso_code(code_hash, client_id, redirect_uri)` | Apixis ID: single-use code exchange; records `sso_links` (needs 009). |
| `get_or_create_wallet`, `find_user_id_by_email`, `release_hold_internal` | Helpers. |

- **SQLSTATE → HTTP:**

| SQLSTATE | HTTP |
|---|---|
| `WA400` | 400 |
| `WA402` | 402 (insufficient) |
| `WA404` | 404 |
| `WA409` | 409, with `code` = `already_captured` / `already_released` / `conflict` |
| `WA403` | append-only violation |
| `WA500` | unbalanced transaction |

- **Idempotency keys** are namespaced by app on the ledger: `<app>:<key>`. The Wallet UI uses `wallet:<uuid>`.

### 2.3 Catalog
`ApixisWallet/lib/catalog.ts` is the only price list. Awad approves every new SKU or price change.
- `days: 30` marks time-limited SKUs.
- New today: `renoxis.email_draft` (50 Ixis) and `renoxis.offer_letter` (100 Ixis), per-use. These replace Renoxis's retired office ledger.
- Canonical app slugs come from `canonicalAppSlug()` (e.g. `contentbot`, not `personalcontentbot`; `apixis`, not `apixis.dev`).
- Halaxis has **no SKUs yet**.

---

## 3. What was built today in ApixisWallet

### 3.1 Security and correctness (migration 007, applied live)
Each bug below was reproduced on a real Postgres before it was fixed:
1. **Anyone could mint Ixis.** Supabase grants EXECUTE on new public functions to anon/authenticated by default, and the money functions are SECURITY DEFINER, so `rpc('credit_xp')` with the public key minted Ixis. They're now service_role only. Verified live: 0 open.
2. **Refunds added Ixis instead of removing it.** Migration 003 had flipped the sign. Fixed.
3. **Concurrent reserves could overdraw a wallet.** Fixed with a row lock. A 20-way concurrency test lets exactly 5 of 20 through against a 5,000 Ixis wallet.
4. **Releasing a captured hold returned success,** so a lost capture response led sites to remove access from charged customers. Now it's `409 already_captured`.
5. **Idempotency keys were global and unchecked** (another site's or user's hold could come back). Now they're namespaced and verified.
6. **Holds never expired.** Now they expire after 30 min (lazy release plus the daily cron).
7. **Monthly seats never expired.** Now they get 30 days, stacking.
8. **The ledger could be edited.** It's now append-only and always balanced.
9. **App slugs normalised.**

Live check before applying 007: the ledger held **test/QA data only** (57 rows, all `@apixis.dev` accounts), with no real customers and no sign of abuse. Awad chose to **keep** the test rows (now permanent). A rolled-back live dry run passed: credit → reserve → capture → 30-day seat → release-after-capture = WA409 → refund debits.

### 3.2 Apixis ID, one family login (migration 009, NOT yet applied)
- **Adds:** `wallet_api_clients.redirect_uris` and `require_sso`, a unique active client name, `sso_codes` (hashed, single use, 2 min), `sso_links`, and `consume_sso_code()`.
- **Flow:**
  1. Site `/auth/apixis/start?next=/x` sets an httpOnly `state` cookie and redirects to Wallet `GET /sso/authorize?client_id=<site>&redirect_uri=<exact callback>&state=…`.
  2. If the person isn't signed in on the Wallet, they sign in there (magic link or password), then return to authorize.
  3. The Wallet redirects to `<callback>?code=…&state=…`.
  4. The site server calls `POST /api/sso/token` with its **own `apx_` key** and `{code, redirect_uri}`, and gets `{ sub, email, email_verified: true }`. The legacy shared key is refused here.
  5. The site creates or finds its own Supabase user for that email (service role), stores `app_metadata.apixis_sub = sub`, creates the session with `generateLink(magiclink)` + `verifyOtp`, and redirects to `next`.
- **Guarantees:**
  - The redirect URI must match a registered callback exactly (https, or http on localhost only).
  - Errors never redirect, so there's no open redirect.
  - A code works once, for one client and one redirect URI, for 2 minutes.
- **Linking:** a site's key can act by `owner_id` only for people linked to that site in `sso_links` (they signed in there). `require_sso=true` per client turns off the email fallback.

### 3.3 Shared-wallet APIs
- **`GET /api/v1/balance?owner_id=<sub>&history=N`** (site key): `{ available, paid, bonus, reserved, usd, rate, history }`. History shows only that site's receipts plus purchases.
- **`GET /api/v1/wallet`**, **`/api/v1/ledger`** (Wallet user, via cookie or Wallet access token) and **`POST /api/v1/redeem`** (Wallet UI, same-origin JSON).
- **`GET /api/v1/reservations/:id`** (site key): `held | expired | captured | released`, plus `receiptId`, for reconciling.
- **Checkout destinations** now accept every catalog app (Lyrixis, Rawixis, Geoxis, Launchixis, Nursery Toons, Qahwah World, …).

### 3.4 Legal record (migration 008, applied live)
- `audit_events`: append-only, service_role only, with a sequential reference `APX-########` (numbering starts at APX-00000002, because 00000001 was used by the rolled-back dry run), made idempotent by `dedupe_key`.
- **Event types:**
  - `checkout_started`: user, email, pack, price shown, Stripe session, terms version, IP, user agent.
  - `purchase` (**required**; the webhook returns 500 and Stripe retries if it can't write): all Stripe ids, receipt URL, amount, tax, country.
  - `refund` and `dispute_lost` (required).
  - `reserve`, `capture`, `release`, `redeem`: site, email, product, Ixis, IP, and rejected attempts too.
  - `hold_expiry_sweep`.
- **Export:** `GET /api/admin/audit?from&to&type&email&app&format=csv`. Master account only, and it must have a confirmed email.
- **Checkout options:**
  - The final-sale notice always shows.
  - `STRIPE_REQUIRE_TERMS=true` adds a terms checkbox (needs a Terms URL set in Stripe).
  - `STRIPE_CREATE_INVOICES=true` creates Stripe PDF invoices (Stripe charges per invoice).
  - `TERMS_VERSION` is stored on every purchase.

### 3.5 Per-site API keys
- **Stored:** in `wallet_api_clients`. Only the SHA-256 hash is kept, scoped to `app_slugs`, with registered `redirect_uris`.
- **Format:** `apx_live_…` or `apx_test_…`.
- **Legacy:** the Wallet's Supabase service key still works as a bearer, **unscoped**, until `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`. It must then be rotated, because it was shared with every site.
- **Mint all at once:** `npm run family-keys` prints one SQL block plus each site's env block. Keys never touch disk.
- **Mint one:** `npm run api-key -- --name <site> --apps <app> --redirect https://<domain>/auth/apixis/callback`.
- **Revoke:** `update public.wallet_api_clients set active=false, revoked_at=now() where name='<site>';`

### 3.6 SDK v3 (`sdk/apixis-wallet.ts`, erasable TypeScript, server only)
| Export | Notes |
|---|---|
| `redeem({ owner, productKey, idempotencyKey, provision, unprovision? })` | `owner` = Apixis ID `sub` or verified email. `ownerEmail` still works (deprecated). |
| `reserve(owner, productKey, key)`, `capture(id)`, `release(id)`, `reservationStatus(id)` | Low level. `release()` throws `WalletError 409 code "already_captured"` if the customer was charged. |
| `walletBalance(owner, { history })` | The shared balance for your header or billing page. |
| `entitlements(owner, app)`, `hasEntitlement(owner, app, productKey)` | Only active rows (`renews_at` null or in the future). |
| `apixisLoginUrl({ state, redirectUri })`, `exchangeLoginCode(code, redirectUri)` | Apixis ID. |
| `buyIxisUrl(app, returnUrl)`, `quote(productKey)`, `WalletError` (`.status`, `.code`, `.insufficient`), `isWalletConfigured()` | |

**How `redeem()` behaves:**
- **`provision()` throws:** the hold is released and the error is rethrown. Nothing was charged or granted.
- **Capture fails:** it's retried once, then the hold is released. Two outcomes:
  - release answers `already_captured`: the customer **was** charged, so `redeem()` returns ok and access is kept;
  - release succeeds: the customer was not charged, so `unprovision()` runs and the error is rethrown.
- **Wallet unreachable during all of this:** the error is rethrown **without** unprovisioning. Reconcile with `reservationStatus()`.
- **402:** returns `{ ok: false, insufficient: true }`. Show Buy Ixis.

`sdk/apixis-login-next.ts`:
- **Exports:** `startApixisLogin`, `finishApixisLogin`, `apixisSubOf(user)` and `apixisOwner(fallbackEmail)`.
- **Needs:** `@supabase/ssr`, `@supabase/supabase-js`, plus the site's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `_PUBLISHABLE_KEY`) and `SUPABASE_SERVICE_ROLE_KEY`.
- **Rawixis exception:** Rawixis's copy uses `lib/supabase/admin.ts` instead, because of its key-isolation test.

### 3.7 Wallet UI (data only; design unchanged)
- `components/WalletScreen.tsx` now reads the real balance, history and redeem through `lib/wallet-client.ts`. The fake 40,350 balance is gone. Signed-out visitors get a sign-in prompt.
- **Still Awad's (design):** the Tape/Market tab reads like an investment ("Cap", "24h vol", ticker symbols), which `POLICY.md` forbids. Relabel or remove it before launch.

### 3.8 Tooling and CI
- `npm run check`: lint, typecheck, unit tests (61) and build.
- `npm run test:sql`: runs every migration on a throwaway Postgres, plus the ledger, audit and Apixis ID tests and the concurrency test. Never point it at production.
- `.github/workflows/ci.yml`: runs both on every PR.
- `supabase/tests/00_supabase_stub.sql`: fakes Supabase roles for local/CI runs only.

### 3.9 Wallet PRs
- **#6 merged:** launch hardening (007/008, APIs, SDK v2, legal record, CI).
- **#7 open** (branch `claude/epic-rubin-oen8nu`):
  - the Wallet screen shows real data
  - Apixis ID
  - `/api/v1/balance`
  - SDK v3 and the login kit
  - family keys
  - buy-from-every-site
  - `docs/LAUNCH_KEYS.md`
  - `docs/SECURITY_SCAN_2026-09-23.md`
  - this update

  **Apply 009 before merging.**

---

## 4. Security work across the family

**Fixed live today** (Supabase, applied directly):
- **Geoxis** (`ncifprfgastofurrlsko`): `admin_emails` had RLS off and INSERT open to anon, so anyone could make themselves admin. It's locked now; verified there was only 1 admin row (the owner's domain), so it wasn't abused.
- **Lyrixis** (`mkuvgkjakxkytscfvnkf`): `magic_links` (email + token) was readable and writable by anon, which allowed account takeover. It's locked to the service role. `support_tickets` was fully open; now anyone can insert, users read only their own, and there's no anon read/edit/delete. **If Lyrixis's custom magic-link login reads `magic_links` with the anon key, it must move server-side.**

**Fixed in code, needs its migration at merge:**
- **Recovra:** `grant_plan_entitlement()` let any signed-in member grant a paid plan for free. PR #4 adds the service-only `grant_plan_entitlement_for()` (migration `20260923000001_plan_entitlement_service_only.sql`) and the server-side call. **Apply the migration and merge together.**

**Open (from `docs/SECURITY_SCAN_2026-09-23.md`):**
- Lyrixis view `my_track_unlocks` and Geoxis view `current_asset_positions` are SECURITY DEFINER; switch them to `security_invoker`.
- Helpers are callable by anon: Geoxis `is_member()`/`is_admin_user()`, Socixis `is_org_member()`, Contraxis and "313aidaroos's Project" `handle_new_user()`/`rls_auto_enable()`.
- Functions with a mutable `search_path` exist in Contraxis and 313aidaroos's Project; `citext` is installed in public.
- **Halaxis project not scanned yet.**
- **Leaked-password protection is OFF in every project.** Awad enables it in the dashboard.

**Reported as INFO only (fine):** "RLS enabled, no policy" means a deny-all table, which is correct when only server code reads it.

---

## 5. Per-site rollout (all PRs open, branch `claude/apixis-id-shared-wallet` unless noted)

Every Next.js site below received the same package:
- `lib/apixis-wallet.ts` replaced by SDK v3 (same path)
- `lib/apixis-login.ts` added (copy of `sdk/apixis-login-next.ts`)
- `app/auth/apixis/start/route.ts` and `app/auth/apixis/callback/route.ts` added
- `app/api/wallet/balance/route.ts` added: the shared balance plus a `buy` URL back to the referring page
- `components/ApixisWalletChip.tsx` (balance + Buy Ixis) and `components/SignInWithApixis.tsx` added
- redeem call switched to `owner: await apixisOwner(<verified email>)`
- `docs/APIXIS_FAMILY.md` (bot notes) added, plus a pointer in `AGENTS.md`/`CLAUDE.md`

| Site | Repo / PR | Site-specific changes | Env to add (Vercel) | Checks | Notes |
|---|---|---|---|---|---|
| Renoxis | Renoxis.dev #18 | Office Ixis ledger **retired**: email/offer drafts are paid from the Wallet (`lib/renoxis/wallet-charge.ts`, SKUs `renoxis.email_draft`/`renoxis.offer_letter`); free actions don't touch any ledger; `/api/brokerage/grant` returns 410; Team board and Command desk show the shared balance (`useWalletBalance`); login button; seat redeem uses the Apixis owner; `redeem-safety` tests updated to the v3 contract, plus a new lost-capture test | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=renoxis` | 53/53 tests, tsc, lint 0 errors, build | The team-billing behaviour changed: the person who clicks pays from their own Wallet. The old `renoxis_*_ixis` SQL functions and tables remain in the Renoxis DB but are unused. |
| Socixis | Socixis #32 (app in `socixis-app/`) | Wallet page shows the balance (replaces "does not display your balance") | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=socixis` | 116/116, tsc, lint, build | `socixis-app/lib/stripe-checkout.js` exists; review it against the no-site-Stripe policy |
| Recovra | Recovra #4 | Free-plan hole closed (§4); wallet panel shows the balance; `src/lib/supabase/service.ts` added | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=recovra`, **`SUPABASE_SERVICE_ROLE_KEY` (new, required)** | 56/56, tsc, lint 0 errors, build | Merge **with** its migration |
| Lyrixis | Lyrixis #6 | App nav shows the balance; track-unlock redeem uses the Apixis owner; `CLAUDE.md` created | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=lyrixis`, **`SUPABASE_SERVICE_ROLE_KEY` (new)** | 23/23, tsc, lint, build | See the magic_links note in §4 |
| Rawixis | Rawixis.dev #15 | `readSessionIxisBalance` now uses the Wallet SDK (the old probe hit a nonexistent endpoint keyed on the Rawixis uid; `fetchIxisBalance` kept, marked deprecated); login uses `createAdminClient()` for key isolation; **fixed the red build** (2 unused-var lint errors) | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=rawixis` | tsc, lint 0 errors, build; tests 242/245 | 3 failures already on `main`: 2 landing-copy tests + 1 `fetchIxisBalance` env test |
| Contraxis | Contraxis.dev #22 | Contractor dashboard shows the balance; Pro redeem uses the Apixis owner; `CLAUDE.md` created | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=contraxis` | 24/24, tsc, lint, build | |
| Launchixis | Launchixis #3 | `/pricing` shows the balance next to Buy Ixis; JS project with TypeScript available | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=launchixis`, `SUPABASE_SERVICE_ROLE_KEY` | 24/24, lint, build | |
| Qahwah World | qahwahworld #5 | Home shows the balance; seat redeem uses the Apixis owner | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=qahwahworld`, `SUPABASE_SERVICE_ROLE_KEY` | tsc, lint 0 errors, build (install with **pnpm**); tests 24/25 | 1 date-dependent seat test also fails on `main`. Its Stripe code is the physical-coffee marketplace (Connect + Apixis fee), not Ixis; physical orders stay disabled until Awad approves. |
| PersonalContentBot | PersonalContentBot #1 | `/pricing` shows the balance; clip redeem uses the Apixis owner; no login page exists, so link to `/auth/apixis/start?next=/` | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=contentbot`, `SUPABASE_SERVICE_ROLE_KEY` | build | tsc error already on `main` (`.ts` import in `tests/rules.test.ts`) |
| Deduxis | Deduxis #1 | `/pricing` shows the balance; seat redeem uses the Apixis owner | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=deduxis`, `SUPABASE_SERVICE_ROLE_KEY` | tsc, build | eslint shows 26 problems (21 errors), identical on `main` |
| Halaxis | Halaxis.dev #5 (`src/`) | Header shows the balance next to Buy Ixis | `WALLET_API_KEY`, `APIXIS_CLIENT_ID=halaxis`, `SUPABASE_SERVICE_ROLE_KEY` | tsc, lint, build | **No Wallet SKUs yet**, so Buy Ixis opens the Wallet itself (`product=wallet`) |
| Geoxis | Geoxis #1 (branch `claude/apixis-family-notes`) | Notes only | `WALLET_API_KEY` | — | Static HTML + serverless; Apixis sign-in is next |
| Nursery Toons | NurseryToons #1 (notes branch) | Notes only | `WALLET_API_KEY` | — | Redeem is already safe: access comes from Wallet entitlements |
| Apixis.dev | Apixis.dev #38 (notes branch) | Notes only | `WALLET_API_KEY` | — | `api/checkout.js` and `shared/citizens.js` still reference a direct Stripe checkout; review against policy (Citizen activation = `apixis.activate`, 2,000 Ixis) |

Not touched: AwadBot, awad-command, AFCCommand.

---

## 6. API reference (Wallet, base `https://apixis-wallet.vercel.app`)

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/checkout` | Wallet session | `{ packId: spark\|agent\|office\|business, return_url?, product? }` → `{ url }` (Stripe) |
| `GET /api/checkout/status?session_id=` | Wallet session | Success-page polling |
| `GET /api/checkout/return?session_id=` | Wallet session | 302 to the stored, allowlisted return URL |
| `POST /api/webhooks/stripe` | Stripe signature | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.closed` |
| `POST /api/v1/quotes` | public | Catalog price (informational) |
| `POST /api/v1/reservations` | site key | `{ productKey, idempotencyKey (8–80 printable, no spaces), owner_id \| owner_email }` → 201 `{ reservationId, status, app, ixis }` · 402 · 403 · 404 · 409 |
| `GET /api/v1/reservations/:id` | site key | Status for reconciling |
| `POST /api/v1/reservations/:id/capture` | site key | Idempotent · 409 `already_released` |
| `POST /api/v1/reservations/:id/release` | site key | Idempotent · 409 `already_captured` (keep access) |
| `GET /api/v1/entitlements?app=&owner_id=\|owner_email=` | site key or Wallet user | Active rows only; a site key sees only its own apps |
| `GET /api/v1/balance?owner_id=&history=` | site key | The shared balance shown inside a site |
| `GET /api/v1/wallet`, `GET /api/v1/ledger` | Wallet user | Balance and receipts |
| `POST /api/v1/redeem` | Wallet session, same-origin JSON | In-Wallet reserve + capture |
| `GET /sso/authorize` | browser | Apixis ID authorize (needs 009) |
| `POST /api/sso/token` | site's own `apx_` key | Code → `{ sub, email, email_verified }` (needs 009) |
| `GET /api/cron/release-holds` | `Bearer $CRON_SECRET` | Daily sweep |
| `GET /api/admin/audit` | master session | Legal export (JSON/CSV) |

---

## 7. Environment variables (master list)

**Wallet (Vercel project apixis-wallet):**
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ALLOWED_EMAIL=awad@apixis.dev`
- `STRIPE_RESTRICTED_KEY`: needs Checkout Sessions (write), PaymentIntents and Charges (read), and Invoices (write) if invoices are on
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_IXIS_{SPARK,STARTER,STUDIO,EMPIRE}_PRICE_ID`
- **New:** `CRON_SECRET`, `TERMS_VERSION=2026-09-23`
- Optional: `CHECKOUT_RETURN_HOSTS`, `STRIPE_REQUIRE_TERMS`, `STRIPE_CREATE_INVOICES`, `WALLET_ALLOW_LEGACY_SERVICE_KEY` (set `false` later), `IXIS_ASSET_MODE` (keep `demo`)

**Each site:**
- `WALLET_API_KEY`: its own `apx_live_` key
- `APIXIS_CLIENT_ID`: the site name as in `scripts/create-family-keys.ts`
- `APIXIS_WALLET_API_URL=https://apixis-wallet.vercel.app`
- Its own Supabase `NEXT_PUBLIC_SUPABASE_URL` and anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` (its own project, server only)
- Optional: `NEXT_PUBLIC_SITE_URL` / `APIXIS_REDIRECT_URI` if the callback host differs from the request origin

**Registered callback per site:** `https://<site-domain>/auth/apixis/callback`. The domains `npm run family-keys` uses are in `scripts/create-family-keys.ts`:

| Site | Domain |
|---|---|
| renoxis | renoxis.dev |
| socixis | socixis.dev |
| recovra | recovra-three.vercel.app |
| lyrixis | lyrixis.vercel.app |
| rawixis | rawixis.vercel.app |
| contraxis | contraxis-dev.vercel.app |
| geoxis | geoxis.vercel.app |
| launchixis | launchixis.vercel.app |
| nurserytoons | nurserytoons.vercel.app |
| qahwahworld | qahwahworld.vercel.app |
| contentbot | personalcontentbot.vercel.app |
| deduxis | deduxis.vercel.app |
| apixis | apixis.dev |

**Awad confirms these before running.**

---

## 8. Rules for every bot (do / don't)

**Do**
- Read `ApixisWallet/AGENTS.md` and your repo's `docs/APIXIS_FAMILY.md` first.
- Use SDK v3 `redeem()` for every paid action, with a stable idempotency key per click (8–80 printable characters, no spaces, no email in it).
- Pass `owner: await apixisOwner(user.email)`: the Apixis `sub`, else the verified session email.
- Grant access inside `provision()`, and undo it only in `unprovision()`.
- Show Buy Ixis with `buyIxisUrl(app, currentPageUrl)`.
- Add any new SKU to `ApixisWallet/lib/catalog.ts`, and only with Awad's approval.
- For any new `public` SQL function: `revoke all ... from public, anon, authenticated`, then grant to `service_role` only when it's server-side.
- Ship a SQL test with any Wallet SQL change (`supabase/tests/`), and run `npm run check` plus `npm run test:sql`.
- Update `AGENTS.md` (§0b table) when you merge or change something family-wide.

**Don't**
- Create a per-site Ixis balance, ledger, "office budget", credits table or grant button.
- Run Stripe Checkout for plans or Ixis on a sister site. (Physical-goods marketplaces like Qahwah World coffee are a separate case, owner-approved.)
- Edit `lib/apixis-wallet.ts` / `lib/apixis-login.ts` in a site repo. Change the SDK in ApixisWallet and copy it.
- Trust an email or owner id from the request body or browser.
- Remove access after a capture. Treat release `409 already_captured` as "charged".
- Write to `ledger_*` or `audit_events` directly. Use the functions; the tables are append-only.
- Put secrets in `NEXT_PUBLIC_*`, logs, GitHub or chat.
- Add expiry to paid Ixis, offer refunds, or add investment/trading language or a crypto "convert" button (D1, D3, D8).
- Restyle UI (Awad owns design). Data-only wiring is fine.

---

## 9. Known issues and pre-existing failures (not caused today)

- **Rawixis:** 3 vitest failures on `main` (2 landing-copy tests, 1 `fetchIxisBalance` env test).
- **Qahwah World:** 1 date-dependent test fails on `main`. It needs **pnpm** (npm with `--legacy-peer-deps` breaks `zod/v4` resolution).
- **Deduxis:** eslint 21 errors / 5 warnings, identical on `main`.
- **PersonalContentBot:** a tsc error on `main` (`tests/rules.test.ts` imports with a `.ts` extension).
- **Renoxis:** 2 eslint warnings (unused `loginForm`, `activateHref`).
- **Wallet:** 1 eslint warning (`window.location.assign` in `WalletScreen`).
- **Partial Stripe refunds** are logged, not applied to the ledger.
- **Bonus expiry** is not enforced.
- **Rate limiting** isn't built (use the Vercel firewall).
- The Wallet `public` → `wallet` schema move is deferred.

---

## 10. Ownership split

- **Awad (design/UI):** `components/**`, `app/**/page.tsx`, layouts, CSS, copy, marketing/news/tape content.
- **Lead developer (backend/plumbing):** `supabase/**`, `app/api/**`, `lib/api/**`, `lib/stripe/**`, `lib/supabase/**`, `lib/checkout/**`, `lib/catalog.ts` (prices need Awad's approval), `sdk/**`, `scripts/**`, `test/**`, `.github/**`, `vercel.json`, and every site's `lib/apixis-*.ts`, `app/auth/apixis/**`, `app/api/wallet/**`.
- **Small components that were added for wiring** (`ApixisWalletChip`, `SignInWithApixis`) are intentionally unstyled. Awad may restyle them. Don't change their data behaviour.

---

## 11. Open work, in priority order (lead developer)

1. Apply Wallet migration **009** (when the Supabase connector is enabled, or Awad runs it). Then merge ApixisWallet #7.
2. Help Awad through `docs/LAUNCH_KEYS.md`: family keys, Vercel env, Stripe events, leaked-password protection. Merge the site PRs in order and run the 5-minute Stripe test-mode check.
3. Recovra: apply migration `20260923000001` together with merging #4.
4. Apixis sign-in for the static sites (Geoxis, Nursery Toons, Apixis.dev), using serverless start/callback routes.
5. Policy review: Socixis `stripe-checkout.js` and Apixis.dev `api/checkout.js`. Retire any direct Stripe checkout for plans or Ixis.
6. Open security items in §4 (definer views, anon-callable helpers, search_path) and the Halaxis project scan.
7. After every site runs on its own key: set `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` on the Wallet, rotate the Wallet service key, and set `require_sso=true` per site once it's on Apixis ID.
8. Halaxis SKUs (Awad sets prices), an owner dashboard, rate limiting, Terms and Privacy pages (with counsel), and relabelling the Tape tab (Awad, design).
9. Retire the unused Renoxis `renoxis_*_ixis` functions and tables in a later cleanup migration.

---

## 12. Glossary

- **Ixis:** the family's single unit of value (100 Ixis = $1). It's platform credit today and a future coin (D8).
- **Apixis ID `sub`:** a person's Wallet user id, returned by `/api/sso/token`, stored per site as `app_metadata.apixis_sub`.
- **Hold / reserve:** Ixis set aside for a pending purchase. **Capture:** the purchase happened (charged). **Release:** it didn't (not charged).
- **Entitlement:** what a person owns on a site, written by capture. `renews_at` null means forever; a date means the access is active until then.
- **Site key (`apx_live_…`):** a sister site's own credential, scoped to its app(s). The **legacy key** is the old shared Wallet service key, to be retired.
- **Clearing wallet:** the system counter-account that makes every ledger transaction balance.
- **`APX-########`:** the reference number on every audit record; quote it to customers and for legal requests.

---

## 13. Merge order (don't improvise)

1. **Wallet database:** apply `009_apixis_id.sql` (the Wallet's live DB already has 007/008).
2. **Wallet PR #7:** merge, then add `CRON_SECRET` and `TERMS_VERSION` in Vercel.
3. **Keys and settings** (the sites' "Sign in with Apixis" needs these first):
   - run `npm run family-keys`
   - paste its SQL into the Wallet database
   - paste each site's env block into its Vercel project
   - add `SUPABASE_SERVICE_ROLE_KEY` to each site
4. **Site PRs:** merge each one: Renoxis #18, Socixis #32, Recovra #4 (**with its migration**), Lyrixis #6, Rawixis #15, Contraxis #22, Launchixis #3, Qahwah World #5, PersonalContentBot #1, Deduxis #1, Halaxis #5. The notes-only PRs (Geoxis #1, NurseryToons #1, Apixis.dev #38) are safe any time.
5. **Test:** the Stripe test-mode run: sign in with Apixis → Buy Ixis → return with the balance → redeem → check the audit export. Then switch to live keys.

Questions go to the lead developer, through Awad. Keep this file and `AGENTS.md` accurate: if you change something, update both.
