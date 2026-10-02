# Apixis family — status board (one page, every AI reads this first)

**Owner:** Awad (313aidaroos). **Rules:** `AGENTS.md` §0 (D1–D16). **Last updated: 2026-10-02 night (Claude).** Owner to-do: **`docs/OWNER_CHECKLIST.md`**. Keys go in with the launch kit: **`docs/LAUNCH_KIT.md`** (`npm run launch`). Previous brief: `docs/MORNING_BRIEF_2026-10-01.md`.

This is the only family-wide status board (D15). Per-repo `NOTES/*.md`, `JUNOAI_NOTES.md`, `WORKBOARD.md`
and `LAUNCH_NOTES.md` are archives. If you change family status, change it here. Every code change: `AI_CHANGELOG.md` in that repo.

## How the family works (the short version)

- **One cash register:** this Wallet. 100 Ixis = $1. Only the Wallet runs Stripe for Ixis. No refunds, no expiry, no cash-out.
- **One login:** Apixis ID. The Wallet's Supabase project is the identity provider; sites use `/sso/authorize` + `/api/sso/token`.
- **One SDK:** `sdk/apixis-wallet.ts` (v3.1), `sdk/apixis-login-next.ts`, `sdk/apixis-redirect.ts`, `sdk/apixis-cixy.ts`. Sites carry byte-identical copies as `lib/apixis-*.ts`. Change here, then copy.
- **Redeem contract:** reserve → provision → capture (or release). `409 already_captured` = charged, keep access. Idempotency key `<app>:<key>`, 8–80 chars. Owner = Apixis ID `sub` first, verified email only as legacy.
- **Marketplace orders (v3.1):** `marketplaceOrder()` holds the buyer's Ixis up to 30 days; `marketplaceSettle()` pays the seller amount − 5% (D12). Used by Ominix.
- **World kit:** Apixis.dev `sdk/apixis-world*.ts` + `POST /api/agent/provision`. Every sign-up gets a wallet + avatar agent + 1,000 starter Ixis (D11).
- **Cixy:** one persona, `sdk/apixis-cixy.*` (`docs/CIXY.md`). Product role is the only site-specific text. Brain down → calm 503, never a vendor error.

## Waiting on Awad (keys / pastes / toggles) — see the morning brief §2

| Item | Why it is blocked | Who |
|---|---|---|
| `npm run family-keys -- --only ominix,wattixis` → SQL into Wallet Supabase + 3 env vars each. The other 14 sites already have keys; never re-mint them (breaks sign-in; migration 012 refuses). | Keys are printed once, never stored. | Awad |
| Hub project SQL: `docs/security/2026-09-30-hub-project-lint.sql`, `PersonalContentBot/supabase/pcb_jobs_durable.sql` | Claude's connector has no write access to `myfclypikkcvfurkbzmj`. | Awad |
| Leaked-password protection ON (15 projects) | Dashboard-only setting. | Awad |
| Anthropic credits | Rawixis/Recovra report insufficient credits; Cixy answers "resting" until topped up. | Awad |
| Recovra `SUPABASE_SERVICE_ROLE_KEY`, Lyrixis `REDIS_URL` + `TRANSCRIPTION_API_KEY`, PCB `PCB_DURABLE_JOBS` + `CRON_SECRET` | Env only. | Awad |
| `require_sso=true` per site, `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`, secret rotation | After keys are in and Apixis sign-in verified live. | Claude on Awad's go |
| Terms / Privacy pages | Counsel/Awad review before publishing. | Awad |
| Live smoke tests against the deployed sites | This Claude environment's network policy blocks `*.vercel.app` and the custom domains. | Awad (allow hosts) → Claude |

## Per-repo status (backend) — all on `main`, deployed

Legend: **Sell** = can take Ixis for something today once its `WALLET_API_KEY` is in Vercel. CI = shared `node-ci` on push/PR.

| Repo | Backend state | Sell | CI | Open items |
|---|---|---|---|---|
| ApixisWallet | Ledger, SSO, Stripe, SDK v3.1, marketplace orders, rate limits, audit, Cixy SDK. 95 tests. Migrations 007–011 live. | Yes | ✓ | Legacy key still accepted; `require_sso=false`; Terms/Privacy. |
| Renoxis | Seats via Wallet, PKCE, `apixisSubOf`. Cixy prompt already matched the rule. | Yes | ✓ (added) | — |
| Socixis | Skins/packs/autopilot via Wallet. Stripe webhook 410 (D14). Cixy matched. | Yes | ✓ (added) | Render SKUs gated off; PRs #47/#48 unreviewed. |
| Contraxis | Pro redeem via Wallet. Stripe webhook 410. Cixy on shared core. | Yes | ✓ (added) | Delete duplicate Vercel project `temporary-turbo-sienna…`. |
| Recovra | Reserve/capture-first plans, Apixis ID routes, Cixy on shared core + calm fallback. 65 tests. | After key | ✓ | Production service key not configured. |
| Deduxis | Callback `type: "email"`, owner = Apixis `sub`, Cixy on shared core + fallback. `receipts` + `category_overrides` tables and private `receipts` bucket created live 2026-10-02 (were missing). | Yes | ✓ (added) | — |
| Lyrixis | Track unlock via Wallet, OTP login. Cixy matched. 39 tests. | Yes | ✓ | `REDIS_URL`, `TRANSCRIPTION_API_KEY`, worker host. |
| Rawixis | Buyer seats via Wallet, admin key isolated, Cixy on shared core. 288 tests. | Yes (seats) | ✓ | Anthropic credits; end-to-end deal not verified. |
| qahwahworld | Roaster seat via Wallet, PKCE, Cixy on shared core (neutral opener). 28 tests. | Yes (seat) | ✓ | Seller seat / featured listing SKUs unused. |
| Halaxis | PKCE, world-agent wiring. Payments intentionally off. | No SKUs | ✓ | Do not enable trading features. |
| Launchixis | Redeem answers 409 "not on sale" by design. Cixy on shared core + fallback. 24 tests. | Off | ✓ | — |
| PersonalContentBot | Clip redeem via Wallet; durable jobs (retry-safe, reconcile cron) behind `PCB_DURABLE_JOBS`; Cixy on shared core + fallback. 15 tests, tsc clean. | Yes | ✓ | Awad: SQL + 2 env vars. |
| Apixis.dev | Hub, world kit, provision endpoint, pulse cron. Starter 1,000. Redeem requires `attemptId`, owner = Apixis `sub`. 218 tests. | Hub | ✓ | PRs #58/#59 superseded (#59 DO NOT MERGE). |
| Geoxis | JS SDK takes Apixis `sub`; Cixy on shared core + fallback. `PLANS_ON_SALE=false`. | Off | ✓ (added) | — |
| NurseryToons | Idempotency key incl. user; agent metadata via service role; Cixy on shared core + fallback; Cixy test runs. Family plan paused. | Off | — (no package.json) | — |
| Ominix | **Ixis-only (D13)**: award → Wallet hold, complete → Wallet settle (5%). Migration 002 live. | After key | ✓ | Ominix keys in Vercel; a "Complete order" control (design side). |
| Wattixis | Apixis ID sign-in (`/auth/apixis/*`), `api/wallet/balance`, `drafts`/`listings`/`requests` APIs validated + RLS verified; callback `type: "email"`; Cixy on shared core. | After key (no SKUs yet) | — (UI tests red on main: Codex's async draft work pending) | Wattixis keys in Vercel; SKUs are Awad's call. |
| awad-command | Internal tool; dead SDK copy removed. | n/a | — (pnpm) | — |
| AwadBot | `AWADBOT_ON_SALE=false`; Cixy on shared core. 32 tests. | Off | ✓ (added) | Never run trading commands from an AI. |
| Pinixis (new 2026-10-01) | Build/quote/marketplace app. Full schema live 2026-10-02 (`decrement_listing` service-role only). Own Stripe approved (D17); payment routes answer 503 until `STRIPE_*`. Not a Wallet client. | After Stripe keys | — | Stripe webhook + Connect; Vercel project + domain. |
| github-actions | Shared `node-ci.yml`, Node 22. | n/a | — | — |
| afccommand / thenightexchange | Empty / trading-pit sim without Wallet. | n/a | — | — |

## Tester matrix (fill in as paths are actually exercised)

| Site | Path | Prereq | Verified live | Notes |
|---|---|---|---|---|
| Wallet | Buy Spark pack with Stripe test card → balance +1,000 | Apixis ID account | not yet (network) | `docs/LAUNCH_KEYS.md` step 2 |
| Renoxis | Apixis sign-in → buy seat → retry → 409 keeps access | Wallet balance | not yet | |
| Socixis | Apixis sign-in → skin unlock | Wallet balance | not yet | |
| Contraxis | Apixis sign-in → pro seat | Wallet balance | not yet | |
| Recovra | Apixis sign-in → paid plan activation receipt | service key in Vercel | not yet | |
| Ominix | Apixis sign-in → award bid → complete → seller paid − 5% | Wallet key in Vercel | not yet | migrations verified by SQL |
| Any site | Cixy with the shared key out of credit → calm "resting" reply, HTTP 503 | — | code + tests | |

## Security state (2026-09-30 night)
Advisors run on all 15 projects: no ERROR-level findings. Fixed live on Contraxis, Lyrixis, Ominix (trigger functions off RPC, `search_path` pinned). Hub project: SQL for Awad. Remaining WARNs are intentional RLS helper functions (`is_org_member`, `has_org_role`, …) and the leaked-password toggle. Wattixis RLS verified (owner = `auth.uid()`). Wallet money functions remain `service_role`-only.

## Change log pointers
Every repo: `AI_CHANGELOG.md`. Overnight pass: 33 PRs merged 2026-09-30 (Claude). Codex tester-readiness handoff (2026-09-30 ~01:27 CT) preceded it and is not repeated.
