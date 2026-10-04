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
