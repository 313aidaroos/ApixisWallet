# AI Change Log

## Rules for AI models, bots, and agents

If you are an AI (Claude, ChatGPT, Grok, Gemini, Copilot, Cursor, JunoAI, or any other model, bot, or agent) and you add, modify, or delete anything in this repository, you **must** append a dated entry to this file describing what you changed and why — one entry per work session, no exceptions. This log is how the repository owner tracks what every AI did. Human commits do not need entries.

Entry format:

## YYYY-MM-DD — <your name/model>
- Changed: <files or area>
- Why: <reason>

---

## 2026-09-28 — JunoAI
- Changed: created this file
- Why: owner's standing rule — every AI that touches this repo must log its changes here

## 2026-09-30 — Claude (family backend pass, branch claude/awesome-newton-3tygzi)
- Changed: `app/auth/callback/route.ts`, `sdk/apixis-login-next.ts` — `verifyOtp({ type: "email" })` instead of `"magiclink"` (D16).
- Changed: `lib/api/rate-limit.ts` (new) + `test/rate-limit.test.ts`; wired into `/api/v1/reservations`, `/api/v1/redeem`, `/api/sso/token` — burst protection per site key / per person (AGENTS.md §9).
- Changed: `scripts/create-family-keys.ts` — added halaxis, ominix, wattixis so every family site gets a Wallet key.
- Changed: `components/WalletScreen.tsx` — Tape tab no longer shows "Cap" / "24h vol" (POLICY.md: never market Ixis as an asset); absolute URL in `signInHere` to clear the Next lint warning.
- Changed: `AGENTS.md` §0c (decisions D11–D16 of 2026-09-30) and §9; new `docs/FAMILY_STATUS.md` — the single family status board (D15).
- Why: Awad's 2026-09-30 audit confirmation — put every AI on the same page, fix the fleet-wide sign-in bug at its source, and harden the money routes before testers.
- Changed (same session, later): `app/api/v1/marketplace/orders` + `.../[id]/settle`, `lib/api/marketplace.ts`, `test/marketplace.test.ts`, migration `011_marketplace_orders.sql` (30-day holds, `payout` audit type), `lib/audit.ts`, `sdk/apixis-wallet.ts` v3.1 (`marketplaceOrder`, `marketplaceSettle`), AGENTS.md §5.
- Why: D13 — Ominix (and later Rawixis) settle person-to-person orders through the one ledger with the 5% Apixis Bank fee, instead of a local NXC wallet. Migration 011 applied live (Supabase `kzneeksminozmhnqaaun`) on 2026-09-30 and verified: 30-day holds, `payout` audit type, `reserve_xp` still service_role-only.

## 2026-09-30 (night pass) — Claude
- Changed: `sdk/apixis-cixy.ts` + `sdk/apixis-cixy.js` (new): `CIXY_CORE`, `cixySystemPrompt()`, `CIXY_UNAVAILABLE`, `cixyUnavailableReply()`; `docs/CIXY.md` documents the one-persona rule and which sites are aligned.
- Changed: `docs/security/2026-09-30-hub-project-lint.sql` — advisor fixes for the shared hub Supabase project (`myfclypikkcvfurrlsko`) that Claude's MCP user cannot write to; Awad runs it once. Same fixes were applied live by Claude on Contraxis, Lyrixis and Ominix (trigger functions no longer callable via RPC, fixed `search_path`).
- Why: Awad's overnight instruction — all backend and security done, one Cixy persona everywhere (ApixisWallet/docs/CIXY.md, sdk/apixis-cixy.*), agents on the same page (ApixisWallet/docs/FAMILY_STATUS.md).

## 2026-10-01 (early) — Claude
- Changed: `docs/MORNING_BRIEF_2026-10-01.md` (new) and `docs/FAMILY_STATUS.md` rewritten with the overnight state: 33 PRs merged, second-pass verification (every repo: tests, tsc, build) green, security advisor state, and Awad's key/SQL/toggle checklist.
- Why: Awad asked for a morning brief and for every agent to read one board.

## 2026-10-02 — Claude (Claude Code)
- Changed: `scripts/create-family-keys.ts` now requires `--only <sites>` (plus `--list`); geoxis callback host fixed. New `supabase/migrations/012_unique_active_client_name.sql` (applied live): one ACTIVE Wallet client per name.
- Why: running the script for all sites would have inserted duplicate client names; `/sso/authorize` looks clients up by name, so every already-registered site's "Sign in with Apixis" would have failed. Corrected every doc that said to run it for all sites (morning brief, LAUNCH_KEYS, LAUNCH_NOTES, BOT_UPDATE, AGENTS.md) and the wrong hub project ref (`myfclypikkcvfurkbzmj`).
- Changed: new `docs/OWNER_CHECKLIST.md` (Awad's to-do, company by company); `docs/FAMILY_STATUS.md` updated (Deduxis tables, Pinixis row).

## 2026-10-02 (evening) — Claude (Claude Code)
- Changed: `docs/OWNER_CHECKLIST.md` — Deduxis support-form fix and Pinixis database (applied live, see those repos' changelogs) marked done; Pinixis steps rewritten.
- Why: keep the owner's to-do list matching what is live.

## 2026-10-02 (night) — Claude (Claude Code)
- Added: launch kit — `scripts/launch/{companies,plan,kit}.ts`, `.env.launch.example`, `npm run launch` / `launch:check`, `docs/LAUNCH_KIT.md`, `test/launch-kit.test.ts` (12 tests, fake Vercel + Supabase). Owner fills one file; the kit finds each Vercel project by repo, adds only missing env vars (never replaces, never prints values), generates secrets in each site's format, fetches Supabase keys, mints Wallet keys only for sites with no active client, issues world keys + merges `APIXIS_WORLD_KEYS`, runs the hub SQL, turns on leaked-password protection, redeploys changed projects. Owner approved building it.
- Changed: `scripts/family-sites.ts` now holds the site list (shared by family-keys and the kit).
- Decision D17 (owner): Pinixis takes card payments through its own Stripe — AGENTS.md §0c, second exception to D14.
- Changed: `docs/OWNER_CHECKLIST.md` rewritten around the kit; `docs/FAMILY_STATUS.md` Pinixis row.

## 2026-10-02 (night, later) — Claude (Claude Code)
- Changed: `.env.launch.example` names `wallet=apixis-wallet` under `[vercel]`; checklist notes the second Vercel project `aw-live`.
- Why: GitHub shows this repo deploying to two Vercel projects, so the kit would otherwise stop and ask which is the Wallet.

## 2026-10-02 (night, Pinixis) — Claude (Claude Code)
- Changed: launch kit matches a Vercel project by name when it is not connected to GitHub (Pinixis is deployed by hand as `pinixis`); test added. Checklist: connect the Pinixis Vercel project to its repo so merges deploy.
- Why: owner pointed out Pinixis has a Vercel project; it has no GitHub link, so the kit could not find it and merges never reached pinixis.vercel.app.

## 2026-10-02 (night, cross-check) — Claude (Claude Code)
- Changed: `docs/FAMILY_STATUS.md` — live cross-check of all 24 Vercel projects (env var names only, deploy vs GitHub main), Wallet client registry and Supabase; one table of what is really missing; duplicates/leftovers list (nothing deleted). `docs/OWNER_CHECKLIST.md` aligned; `docs/MORNING_BRIEF_2026-10-01.md` marked archived. Launch kit: Geoxis Supabase (`ncifprfgastofurrlsko`).
- Also: Pinixis redeployed from GitHub `main` (`5102a50`, READY); the live site was two merges behind.
- Why: owner asked for every agent in sync, one source of truth, no duplicates.

## 2026-10-02 (late night) — Claude (Vercel connector + Supabase, live settings)
- Live (Wallet DB): registered Wallet clients `ominix` and `wattixis` (new per-site keys; only hashes stored). 16 active clients now.
- Live (Vercel): added `WALLET_API_KEY`/`APIXIS_CLIENT_ID`/`APIXIS_WALLET_API_URL` on ominix + wattixis; `CRON_SECRET` on halaxis + personalcontentbot; `ADMIN_EMAILS` on launchixis; `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (same keys as Deduxis), `ADMIN_EMAIL` on pinixis. Redeployed all six; values are not written anywhere in this repo.
- Changed: `lib/checkout/return-url.ts` — Geoxis's live host `spatial-dashboard-xi.vercel.app` added to the code list (was only in env).
- Changed: `docs/FAMILY_STATUS.md` (what was filled, what is still missing, how the family connects — checked live), `docs/OWNER_CHECKLIST.md`.
- Why: Awad asked to take care of everything marked missing, check how all sites connect, and keep notes so no one gets confused.

## 2026-10-02 (late night, launch prep) — Claude
- Added: `docs/TESTER_MATRIX.md`, `scripts/launch/smoke.ts` + `npm run launch:smoke` + `test/launch-smoke.test.ts` (read-only live check: every site up and its Apixis ID start route hands off to `/sso/authorize` with the right client).
- Added: `docs/legal/TERMS_DRAFT.md`, `docs/legal/PRIVACY_DRAFT.md` — drafts from what the code does, with questions for counsel. Not published; `TERMS_VERSION` unchanged.
- Changed: `docs/FAMILY_STATUS.md` (launch-prep section: merges across the family, 51 PRs closed, what stays open and why, what is blocked), `docs/OWNER_CHECKLIST.md`.
- Live (other repos, each logged in its own AI_CHANGELOG): Ominix #6 merged + its migration applied; 1,000 starter-Ixis wording on 9 repos; Socixis greeting rule + 5% cut; Wattixis async bugs + CI.
- Why: Awad — "do everything across the board and merge and deploy … create notes", "I need these ready for launch".

## 2026-10-04 — Grok (Wallet Lead)
- Changed: `lib/catalog.ts` — added `socixis.avatar.render.90s` (3,000 Ixis) and `socixis.avatar.render.120s` (4,000 Ixis) to `redeemCatalog`; replaced `heldCatalog` with `freeCatalog` (price 0, not quotable): Socixis avatar base, 6 `socixis.site.*` packs, and `shop.template.site.saas` / `.shop` (removed from `shopCatalog`). Tests `test/held-catalog.test.ts`; docs `INTEGRATION.md`, `LAUNCH_NOTES.md`; `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Awad's 2026-10-04 decisions (Socixis request, Socixis NOTES @ fc8950e): website packs and avatar base free; paid 90s/120s avatar videos at 5× HeyGen cost.

## 2026-10-04 (follow-up) — Grok (Wallet Lead)
- Changed: `lib/catalog.ts`: added `socixis.avatar.render.45s` (1,500 Ixis) and `socixis.avatar.render.60s` (2,000 Ixis). Free avatar videos are capped at 30s, with no paid 30s SKU. Tests and docs (`INTEGRATION.md`, `LAUNCH_NOTES.md`), `NOTES/GROK.md`, `WORKBOARD.md` updated to match.
- Why: Awad's scope update, 2026-10-04 4:38 PM CT: the full paid render set is 45s/60s/90s/120s.

## 2026-10-04 (feed tips) — Grok (Wallet Lead)
- Changed: `lib/api/marketplace.ts` (`kind` "order"|"tip", `MIN_TIP_IXIS=10`, `minOrderIxis()`, `marketplaceOrderSchema`), `app/api/v1/marketplace/orders/route.ts`, `sdk/apixis-wallet.ts` (`marketplaceOrder({ kind })`), `test/marketplace.test.ts`, `docs/INTEGRATION.md`, `AGENTS.md`, `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Awad's Oct 4 feed decisions. Apixis.dev feed tips of 10/50 Ixis were rejected by the 100 Ixis order minimum. Tips now have a 10 minimum, while other orders keep 100. Fee rate and rounding (floor) are unchanged, and there is no migration.

## 2026-10-04 (feed Apixis ID owners) — Grok (Wallet Lead)
- Changed: `lib/api/caller-owner.ts` (`FEED_CLIENTS = ["apixis"]`, `marketplace` option, cross-site link check, `ownerLinkAudit`), `lib/api/service-auth.ts` (`ServiceCaller.clientName`), `app/api/v1/marketplace/orders/route.ts` and `.../[id]/settle/route.ts` (opt in + `code` on 403 + audit link field), new `test/feed-owner.test.ts`, `test/backend-hardening.test.ts` (fixtures), `docs/INTEGRATION.md` §8, `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Awad's one-Apixis-ID lock. The Apixis.dev feed names tip/boost buyers and sellers by Apixis ID, which may come from any family site sign-in. Marketplace routes only. Other clients and endpoints are unchanged, with no migration.

## 2026-10-04 — Grok (Wallet executor, branch grok/signup-grant)
- Changed: `supabase/migrations/013_signup_grant.sql` (new: `signup_grants`, `grant_signup_xp`, `revoke_signup_grant`, `settle_marketplace_payout`, audit types), `lib/signup-grant.ts` (new), `app/auth/callback/route.ts`, `app/login/actions.ts`, `app/api/sso/token/route.ts`, `app/api/v1/marketplace/orders/[id]/settle/route.ts`, `lib/api/marketplace.ts`, `components/WalletScreen.tsx`, `supabase/tests/50_signup_grant_test.sql` (new), `supabase/tests/00_supabase_stub.sql`, `scripts/test-sql.sh`, `test/signup-grant.test.ts` (new), `AGENTS.md`, `docs/FAMILY_STATUS.md`, `docs/INTEGRATION.md`, `NOTES/GROK.md` (also fixed the #39 undo line → `git revert 9b8d52c`), `WORKBOARD.md`.
- Why: Awad's lock — 1,000 Ixis per Apixis ID in the one shared Wallet (bonus bucket, once, lazy backfill on next confirmed sign-in) behind `SIGNUP_GRANT_ENABLED` (default OFF; hub flips it with Apixis.dev's in-world starter → 0); bonus-funded marketplace orders pay sellers as bonus so free Ixis never become paid; 79,300 hand-credited test/seed Ixis documented and excluded from revenue.
- Follow-up (notes only): recorded merge `f65b362`, prod deploy, migration 013 apply + verification; undo line now `git revert f65b362`.

## 2026-10-04 — Grok (Wallet Lead)
- Changed: `lib/api/marketplace.ts`, `app/api/v1/marketplace/orders/route.ts`, `app/api/v1/marketplace/orders/[id]/settle/route.ts`, `sdk/apixis-wallet.ts` (3.2), new `supabase/migrations/014_world_orders.sql`, `supabase/tests/60_world_orders_test.sql`, `test/world-orders.test.ts`, `docs/WORLD_ECONOMY_CUTOVER.md`, `docs/INTEGRATION.md` §8b, `AGENTS.md` §5, `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Apixis.dev in-world spending must use the one shared Wallet. Adds `world_trade` (agent → agent, pinned counterparty, 5% fee locked) and `world_purchase` (agent → platform sink) on the existing hold/settle/release path. No path that creates Ixis; reconciliation of in-world balances is a plan only, awaiting Awad.


## 2026-10-04 — Grok (Wallet Lead)
- Changed: `app/layout.tsx` — main UI font Special Elite → Inter (`next/font/google`, system sans fallback); `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Awad asked for a different font on the Wallet site and left the choice to us. Layout, colours and the "Apixis Wallet" name are unchanged.

## 2026-10-04 — Grok (Wallet Lead)
- Changed: `lib/owners.ts` (owner list `OWNER_EMAILS` = awad@apixis.dev + alaidaroosawad@gmail.com, plus `ALLOWED_EMAIL` / optional `ALLOWED_EMAILS`; `isMasterUser` / `masterAccess` require a confirmed email), `app/api/admin/audit/route.ts`, `app/login/actions.ts`, `app/login/page.tsx` (hint text), new `test/owners.test.ts`, `AGENTS.md`, `NOTES/GROK.md`, `WORKBOARD.md`.
- Why: Awad's 2026-10-04 rule — both emails are master/owner admins with full control. Unverified signups for either address get nothing. No SQL, RLS or env change.
- Follow-up (notes only): recorded #47 merge `54ac001`, prod deploy READY, undo `git revert 54ac001`.

## 2026-10-04 — Claude (Claude Code, full-portfolio review)
- Changed: `NOTES/CLAUDE.md` — this repo's slice of the 24-repo review (what is live, what is open, who owns each item, drift found). `docs/FAMILY_STATUS.md` — new section "Full-portfolio review — 2026-10-04" (findings the board did not have, verification table, owner list). No code, env, database or deploy changes.
- Why: Awad asked for every repo to be read twice with a done / to-do / owner status, and for the notes in each repo to be updated. Notes only; Awad approved the merge on 2026-10-04.

## 2026-10-04 — Grok (Wallet Lead): Cixy persona text aligned with Awad's religion lock
- Changed: `sdk/apixis-cixy.ts` / `.js` (`CIXY_CORE` v2: removed the Arab/Muslim-culture line, "Salam"/"As-salamu alaykum"/"Insha'Allah"/"alhamdulillah" guidance, pork/interest-lending and religious-ruling lines), `docs/CIXY.md` (lock text; Halaxis is the only exception), `docs/legal/TERMS_DRAFT.md` §9 (no "halal-conscious" wording), `docs/TESTER_MATRIX.md` row 17.
- Why: Claude's #23 (2026-09-30) codified Islamic greetings and said "Halaxis is not an exception any more", against Awad's lock (no religious/halal content or Islamic greetings outside Halaxis; Cixy is not a "Muslim AI assistant"). No runtime code in the Wallet imports this file; site copies must be re-copied by their leads / Developer Bot. Undo: `git revert` this PR's squash commit.

## 2026-10-04 — Grok (Wallet Lead): Claude-changes audit notes (backfill)
- Changed: `NOTES/GROK.md` (backfilled entry for Claude #48 + the #23 religion-lock finding fixed in #50; today's summary line corrected), `WORKBOARD.md` (task line, done). Notes only; no code, env, DB or deploy change.
- Why: Awad asked at 6:43 PM CT for everything Claude did recently in this repo to be found, verified and logged. Undo: revert this PR's squash commit.

## 2026-10-04 — Grok (Wallet Lead): Cixy canon sync + WALLET_STATS_KEY note
- Changed: `sdk/apixis-cixy.ts`, `sdk/apixis-cixy.js`, `docs/CIXY.md` now byte-identical to Developer Bot's family canon (character line "draws on Arab culture"; the recommendations rule becomes "decline only what is genuinely harmful, deceptive or illegal, never on religious grounds"). `NOTES/GROK.md`: Developer Bot set `WALLET_STATS_KEY` on Production (redeploy dpl_GT9SVmHT2cffxib1jsprVhVwS8Bv). Live check: summary returns 401 without a key. awad-command still lacks the var. `WORKBOARD.md` line.
- Why: Awad's 7:18 PM CT follow-up (one Cixy across the family; record the env change). No SQL, no env change by Wallet Lead, no runtime code. Undo: revert this PR's squash commit.

## 2026-10-04 — Codex: approved Wallet design integration
- Integrated Awad's approved futuristic preview into the existing eight Wallet tabs, with a shared navy/gold/cyan theme, responsive layout, Canvas gold Ixis rain, motion controls, and reduced-motion support.
- Matched Apixis Companies to apixis.dev: original 15 companies, descriptions, destinations, scene artwork, colored borders and serif headings. Added the approved Higgsfield video animations, loaded near the viewport with original-art fallbacks. Videos pause offscreen, in hidden tabs, and when motion is disabled; no SVG company illustrations or SVG animations.
- Replaced demo tape data with a Canvas fixed-rate reference chart ($0.01/Ixis) and the authenticated customer's actual ledger activity across 24H, 1W, 1M, 6M, 1Y and ALL. The transaction stream refreshes every 15 seconds. History is paginated, incomplete periods are labeled, and older records can be loaded. Added loaded-history CSV export.
- Retained canonical catalog prices, Stripe checkout, sibling-app return context, and existing redemption APIs. Added confirmation before spending, duplicate-submit guards, and a stable idempotency key for uncertain redemption retries. No backend, database, migration, catalog, SDK, or environment changes.
- Verification: npm run check passed (lint, typecheck, 153 tests, production build); browser checks covered all eight tabs at 320px, six chart ranges, pagination, matching video cards, and checkout/redemption controls with an isolated local API stub. No real purchases or redemptions were made. Local SQL command could not run because psql is absent; the unchanged ledger suite must pass in GitHub CI before merging.
- Media dependencies: original stills use www.apixis.dev; generated videos use Higgsfield's returned CloudFront URLs. Originals remain visible if playback fails. Undo: revert this PR's squash commit.
