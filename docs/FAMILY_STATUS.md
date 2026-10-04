# Apixis family — status board (one page, every AI reads this first)

**Owner:** Awad (313aidaroos). **Rules:** `AGENTS.md` §0 (D1–D16). **Last updated: 2026-10-04 night, full-portfolio review (Claude); before that 2026-10-04 evening CT, family catch-up.** Owner to-do: **`docs/OWNER_CHECKLIST.md`**. Keys go in with the launch kit: **`docs/LAUNCH_KIT.md`** (`npm run launch`). Previous brief: `docs/MORNING_BRIEF_2026-10-01.md`.

This is the only family-wide status board (D15). Per-repo `NOTES/*.md`, `JUNOAI_NOTES.md`, `WORKBOARD.md`
and `LAUNCH_NOTES.md` are archives. If you change family status, change it here. Every code change: `AI_CHANGELOG.md` in that repo.

## How the family works (the short version)

- **One cash register:** this Wallet. 100 Ixis = $1. Only the Wallet runs Stripe for Ixis. No refunds, no expiry, no cash-out.
- **One login:** Apixis ID. The Wallet's Supabase project is the identity provider; sites use `/sso/authorize` + `/api/sso/token`.
- **One SDK:** `sdk/apixis-wallet.ts` (v3.1), `sdk/apixis-login-next.ts`, `sdk/apixis-redirect.ts`, `sdk/apixis-cixy.ts`. Sites carry byte-identical copies as `lib/apixis-*.ts`. Change here, then copy.
- **Redeem contract:** reserve → provision → capture (or release). `409 already_captured` = charged, keep access. Idempotency key `<app>:<key>`, 8–80 chars. Owner = Apixis ID `sub` first, verified email only as legacy.
- **Marketplace orders (v3.1):** `marketplaceOrder()` holds the buyer's Ixis up to 30 days; `marketplaceSettle()` pays the seller amount − 5% (D12). Used by Ominix.
- **World kit:** Apixis.dev `sdk/apixis-world*.ts` + `POST /api/agent/provision`. Every sign-up gets a wallet + avatar agent. **Correction (2026-10-04):** the "1,000 starter Ixis" provision gave went to the agent's *in-world* balance (`apixis.agents.ixix_balance` / `apixis.ixix_ledger`), not the shared Wallet. That in-world starter is going to 0 (hub, Apixis.dev). The real grant is the Wallet's welcome grant below.
- **Welcome grant (D11, Wallet migration 013):** 1,000 free Ixis per Apixis ID, once, in the shared Wallet's bonus bucket, on the first confirmed sign-in (lazy backfill, no cutoff). Shows on every balance pill via `/api/v1/balance`. Live in Wallet Production with `SIGNUP_GRANT_ENABLED=true`; Apixis.dev's in-world visitor starter is 0.
- **Cixy:** one persona, `sdk/apixis-cixy.*` (`docs/CIXY.md`). Product role is the only site-specific text. Brain down → calm 503, never a vendor error.

## 2026-10-04 current product status (CT)

Shared status: the Socixis Social Feed tab is live on exactly seven sites — AidaroosHolding, Apixis.dev, Pinixis, Rawixis.dev, Renoxis.dev, Socixis, and Wattixis. Feed fix/preview PRs on the other repos remain pending Awad's OK. The 1,000-Ixis signup grant is live in ApixisWallet Production. The world-economy Wallet switch is built behind `WORLD_WALLET_ECONOMY` and remains **off**. Awad's two emails (`alaidaroosawad@gmail.com` and `awad@apixis.dev`) are the family master-admin allowlist; verified/email-proving sign-in is still required where noted.

- **AidaroosHolding:** Feed live, browse-only; owner admin rule shipped. Open: Supabase sign-in/owner workspace setup and any feed fixes awaiting Awad.
- **Apixis.dev:** Feed and shared backend live; world starter cutover is live. Open: remaining feed fix approvals.
- **ApixisWallet:** Signup grant live; world-order contract built behind `WORLD_WALLET_ECONOMY` (off). Open: Awad's economy-switch approval.
- **Renoxis.dev:** Feed live with shared client and owner seat bypass. Open: feed polish approval if requested.
- **Rawixis.dev:** Feed live; Ixis seats, RFQs, quotes, and deals shipped. Open: legal review and end-to-end marketplace verification.
- **Wattixis:** Feed and staff-reviewed marketplace live. Open: final launch/fixture approvals.
- **Pinixis:** Feed live, browse-only; supplier intake and blueprint flow live. Open: Stripe/Connect keys and acting-feed linkage.
- **Socixis:** Feed live; free/paid render catalog prepared with paid renders locked. Open: render/feed fix PRs pending Awad.
- **Contraxis.dev:** Feed preview work is not merged; owner admin/pro bypass shipped. Open: feed approval and Supabase email-confirmation setting.
- **Halaxis.dev:** Feed preview work is not merged; owner allowlist shipped. Open: feed approval and Tavily key.
- **Lyrixis:** Feed preview and upload-worker work are not merged; owner bypass shipped. Open: feed approval, Redis, and transcription key.
- **Deduxis:** Feed preview is not merged; verified-owner receipt/seat bypass shipped. Open: feed approval.
- **Recovra:** Feed preview is not merged; owner support/plan bypass shipped. Open: feed approval and production service key.
- **Geoxis:** No live Feed tab recorded; owner-admin row and allowlist are live. Open: none in the 2026-10-04 feed rollout.
- **Launchixis:** Owner-admin allowlist is live; no Feed tab was merged. Open: none recorded.
- **Ominix:** Verified-owner helper is live and intentionally bypasses no payment gate; no Feed tab was merged. Open: none recorded.
- **qahwahworld:** Owner admin and roaster-seat bypass are live; no Feed tab was merged. Open: none recorded.
- **awad-command:** Internal HQ subscriptions are owner-only and the owner allowlist is live; no Feed tab applies. Open: none recorded.
- **AwadBot:** Paper-only trading configuration was updated; no Feed tab applies. Open: keep live trading disabled.

## 2026-10-04 current product status (CT)

Shared status: the Socixis Social Feed tab is live on exactly seven sites — AidaroosHolding, Apixis.dev, Pinixis, Rawixis.dev, Renoxis.dev, Socixis, and Wattixis. Feed fix/preview PRs on the other repos remain pending Awad's OK. The 1,000-Ixis signup grant is live in ApixisWallet Production. The world-economy Wallet switch is built behind `WORLD_WALLET_ECONOMY` and remains **off**. Awad's two emails (`alaidaroosawad@gmail.com` and `awad@apixis.dev`) are the family master-admin allowlist; verified/email-proving sign-in is still required where noted.

- **AidaroosHolding:** Feed live, browse-only; owner admin rule shipped. Open: Supabase sign-in/owner workspace setup and any feed fixes awaiting Awad.
- **Apixis.dev:** Feed and shared backend live; world starter cutover is live. Open: remaining feed fix approvals.
- **ApixisWallet:** Signup grant live; world-order contract built behind `WORLD_WALLET_ECONOMY` (off). Open: Awad's economy-switch approval.
- **Renoxis.dev:** Feed live with shared client and owner seat bypass. Open: feed polish approval if requested.
- **Rawixis.dev:** Feed live; Ixis seats, RFQs, quotes, and deals shipped. Open: legal review and end-to-end marketplace verification.
- **Wattixis:** Feed and staff-reviewed marketplace live. Open: final launch/fixture approvals.
- **Pinixis:** Feed live, browse-only; supplier intake and blueprint flow live. Open: Stripe/Connect keys and acting-feed linkage.
- **Socixis:** Feed live; free/paid render catalog prepared with paid renders locked. Open: render/feed fix PRs pending Awad.
- **Contraxis.dev:** Feed preview work is not merged; owner admin/pro bypass shipped. Open: feed approval and Supabase email-confirmation setting.
- **Halaxis.dev:** Feed preview work is not merged; owner allowlist shipped. Open: feed approval and Tavily key.
- **Lyrixis:** Feed preview and upload-worker work are not merged; owner bypass shipped. Open: feed approval, Redis, and transcription key.
- **Deduxis:** Feed preview is not merged; verified-owner receipt/seat bypass shipped. Open: feed approval.
- **Recovra:** Feed preview is not merged; owner support/plan bypass shipped. Open: feed approval and production service key.
- **Geoxis:** No live Feed tab recorded; owner-admin row and allowlist are live. Open: none in the 2026-10-04 feed rollout.
- **Launchixis:** Owner-admin allowlist is live; no Feed tab was merged. Open: none recorded.
- **Ominix:** Verified-owner helper is live and intentionally bypasses no payment gate; no Feed tab was merged. Open: none recorded.
- **qahwahworld:** Owner admin and roaster-seat bypass are live; no Feed tab was merged. Open: none recorded.
- **awad-command:** Internal HQ subscriptions are owner-only and the owner allowlist is live; no Feed tab applies. Open: none recorded.
- **AwadBot:** Paper-only trading configuration was updated; no Feed tab applies. Open: keep live trading disabled.

## Full-portfolio review — 2026-10-04 night (Claude, read-only)

Awad asked for all 24 repos to be read twice and for a plain status (done / not done / who does what). Every repo now has a `NOTES/CLAUDE.md` entry with its own slice (Awad's instruction of 2026-10-04 — for Claude's notes it supersedes D15's "notes are archives" until Awad settles the rule). **This review changed no code, env, database or deploy.** Awad approved merging the notes on 2026-10-04; they are on `main` in every repo (read `NOTES/CLAUDE.md` there for the repo's own slice).

**Verified locally (Node 22, 2026-10-04 22:39–22:53Z):** lint / typecheck / tests / production build all pass on ApixisWallet, Qahwah World, Rawixis, Apixis.dev, Contraxis, Wattixis, Aidaroos Holding, Pinixis, Ominix (incl. marketplace RLS tests), Lyrixis, PersonalContentBot, Deduxis, Launchixis, Recovra, Halaxis, Renoxis, Geoxis, AwadBot (dashboard + 336 pytest), AWAD COMMAND (pnpm; app + worker) and Nursery Toons (6 node tests by hand). Socixis: typecheck + build pass; the 2 root-test failures on `e4ebeea` were the hard-coded date that #59 fixed; `socixis-app`'s `next lint` has no ESLint config and CI never runs it. thenightexchange: lockfile out of sync, `npm ci` fails — not verifiable.

**Live cross-check (Vercel, Supabase, GitHub — read-only):**
- Every real site's production deployment is READY on the latest `main`. Vercel `awadbot`: last two production deployments **BLOCKED**. `temporary-turbo-sienna-p6yqsjd` ERRORs on every Contraxis merge. `aw-live`, `workspace`, `contraxis-design-demo` are duplicates (Awad to delete).
- Supabase advisors: no ERROR level anywhere. Hub `myfclypikkcvfurkbzmj` still shows `handle_new_user` / `rls_auto_enable` callable by anon and 5 mutable-`search_path` functions → `docs/security/2026-09-30-hub-project-lint.sql` is **still not applied**; `pcb_jobs_durable.sql` is not applied either. Leaked-password protection is OFF on every project except renoxis.
- Wallet DB: 16 clients, all `require_sso=false`; money functions closed to anon/authenticated (0 rows); ledger = QA only (last purchase 09-28); migration 013 live, `SIGNUP_GRANT_ENABLED` unset (OFF).

**Findings this board did not have (all fixable by Claude on Awad's go):**
1. "1,000 starter Ixis wording everywhere" is not true on 4 sites. User-facing "200 Ixis" is live on Qahwah World (`components/world-welcome-card.tsx`), Renoxis (`components/ApixisWorldWelcome.tsx`, `app/login/page.tsx`), Deduxis and Contraxis (`ApixisWorldWelcome.tsx`); also in Apixis.dev README / `APIXIS_FAMILY.md` / `LAUNCH_READY.md` and the Wattixis + Geoxis `PROVISION_KIT.md`.
2. The copied "Apixis Companies" directory on 12 sites (Wallet `CompaniesDirectory.tsx`, Ominix's own page, Lyrixis, Pinixis, Wattixis footer, Recovra, Halaxis, Renoxis, Deduxis, Socixis, Contraxis, Rawixis, Geoxis `companies.html`, Apixis.dev `companies.html` + `apixis-clients.js` fallback) links Ominix to the retired `nexxis-tau.vercel.app` instead of `ominix-app.vercel.app`.
3. World-kit drift: `apixis-world.ts` on all 15 sites is one revision behind Apixis.dev (missing `aidaroosholding`); `apixis-world-agent.ts` on Deduxis, Halaxis and Contraxis is the old 200-Ixis variant. Wallet SDK copies are byte-identical everywhere ✓; the Launchixis and Rawixis login copies differ on purpose; Geoxis, Wattixis and Apixis.dev carry three different hand-written JS ports because no canonical JS SDK exists in `sdk/`.
4. CI gaps: aidaroosholding and awad-command have no CI at all; Deduxis and Halaxis have no `test` script; Nursery Toons has no `package.json`; AwadBot's bot `tests/` (23 files, 336 tests) run in no workflow (`ci/bot-tests.yml` is not under `.github/workflows`); the shared `node-ci`'s `--if-present` hides all of this.
5. Rule misses: aidaroosholding had no `AI_CHANGELOG.md` (created by this review); Renoxis #37 / #38 merged without entries; Grok keeps updating WORKBOARD / NOTES despite D15.
6. Doc drift: AGENTS.md header date (09-23) and §6 (WalletScreen is no longer demo), README "migrations 001–007", the 09-30 changelog entry and the PCB SQL header name a hub ref that does not exist (`myfclypikkcvfurrlsko`), the Ominix / Socixis / Contraxis / Qahwah World READMEs still describe Stripe or "preview" states, Nursery Toons `APIXIS_FAMILY.md` says "no Apixis sign-in yet".
7. Two Supabase homes: Rawixis data sits in its own project AND in hub schema `rawixis`; the hub also still holds Contraxis's original `public.*` schema (9 profiles). Legacy copies to drop or document.
8. Function grants: Wattixis `enroll_wattixis_admins` / `is_staff` / `review_queue` executable by anon or authenticated (low — trigger fn / null-uid safe); Geoxis `is_admin_user` / `is_member` still anon-executable (open since 09-23); Lyrixis `current_app_user_id` / `current_org_ids` anon-executable.
9. PersonalContentBot's `maxDuration: 300` needs a Vercel plan that allows it; its `.env.example` and `env.example` differ.
10. Nursery Toons now has accounts, an LLM chat and a world-agent card on a site for 2–4-year-olds — COPPA / parental-consent is Awad's decision before testers with children.

**Open PRs at 22:40Z:** Wallet #21 · Socixis #60 (DO NOT MERGE) · Apixis.dev #70, #59 (DO NOT MERGE), #58, #57 · Rawixis #43 · Wattixis #20 · Contraxis #21 (draft) · Ominix #1 (draft) · Nursery Toons #8 · Qahwah World #11 · awad-command #55, #52, #17 (draft) · thenightexchange #2; footer PRs on Renoxis #32, Recovra #13, Deduxis #10, Lyrixis #14 (+ #16 Release Tool), Halaxis #12, Geoxis #7 per the earlier board.

**Only Awad can (summary; detail per repo in `NOTES/CLAUDE.md`):** the keys and tokens in `docs/OWNER_CHECKLIST.md` (Anthropic credits, Vercel + Supabase tokens, Stripe live key / prices / webhooks for the Wallet, Qahwah World coffee and Pinixis), Recovra `SUPABASE_SERVICE_ROLE_KEY`, Lyrixis Redis + transcription key + worker host, Apixis.dev KV, Halaxis Tavily, the four Vercel project deletions, leaked-password toggles, the hub lint SQL (or a Supabase token for the kit), lawyer review of Terms / Privacy, the design PRs, the `SIGNUP_GRANT_ENABLED` cutover, what Wattixis / Geoxis / Launchixis / Nursery Toons sell, keep-or-archive for thenightexchange and afccommand.

## Wallet welcome grant + bonus-safe payouts — 2026-10-04 (Grok, Wallet executor)
- **What shipped:** Wallet migration `013_signup_grant` (`signup_grants` table; `grant_signup_xp`, `revoke_signup_grant`, `settle_marketplace_payout`, all service_role-only) and `lib/signup-grant.ts`, called from `/auth/callback`, the password login and `POST /api/sso/token`. 1,000 bonus Ixis once per Apixis ID; confirmed email + real sign-in; disposable-domain block; per-IP/domain/global limits; mint-ceiling check and `signup_grant` audit row in SQL. Details: `AGENTS.md` §4.
- **Live state:** PR #41 (`f65b362`) deployed (`dpl_gWUTGjPi6HCW6HAyBgg98hk8eR4h` READY); migration 013 applied to `kzneeksminozmhnqaaun` 2026-10-04 5:37 PM CT. The Production flag was switched on at 5:50 PM CT after the Apixis.dev starter cutover; lazy grants are live.
- **Cutover (complete):** `SIGNUP_GRANT_ENABLED=true` is set on Vercel project `apixis-wallet` Production, coordinated with Apixis.dev's in-world visitor starter going to 0. Grants are issued lazily on confirmed sign-in.
- **Marketplace:** bonus-funded orders now pay the seller as bonus. Rule `proportional_paid_floor_v1`: `paid = floor(payout × held_paid / held_total)`, rest bonus. Products need no change; the settle response adds `payoutPaid` / `payoutBonus`.
- **Products:** nothing to change. The balance pill already shows `available` (paid + bonus).

### Hand-credited test/seed Ixis (79,300) — documented, not clawed back
Twelve `purchase` rows on 2026-09-22/23 CT were credited by hand during launch QA (not by the Stripe webhook). Decision (hub, Awad's locks): keep them, never count them as revenue (revenue = `purchase` rows with an `evt_…` external id only). Checked 2026-10-04: **none sit on a real customer account**. All are on Awad's own `awad@` / `awad+…@apixis.dev` addresses or on `victim-…` / `e2e-…@apixis.dev` test users. None of these accounts has ever signed in to the Wallet.

| external_id | Ixis | account (masked) | kind of account |
|---|---|---|---|
| `seed_d856ce` | 5,000 | v•••••-d856ce@apixis.dev | security test user |
| `seed_1ec576` | 5,000 | v•••••-1ec576@apixis.dev | security test user |
| `e2e-top-657a78` | 6,000 | e2e-•••@apixis.dev | e2e test user |
| `awad-test-grant-1790062430` | 5,000 | a•••@apixis.dev | Awad |
| `awad-test-grant-2-1790062899` | 5,000 | a•••@apixis.dev | Awad |
| `recovra-test-1790091549` | 22,000 | a•••+recovra@apixis.dev | Awad (Recovra QA) |
| `qa-lyrixis-1790094477.050110` | 300 | a•••+lyrixis@apixis.dev | Awad (Lyrixis QA) |
| `qa-nursery-1790095044.424794` | 1,000 | a•••+nursery@apixis.dev | Awad (Nursery QA) |
| `qa-qw-1790095749.602540` | 10,000 | a•••+qahwah@apixis.dev | Awad (Qahwah QA) |
| `qa-rx-1790128415.995162` | 10,000 | a•••+renoxis@apixis.dev | Awad (Renoxis QA) |
| `qa-rx2-1790128567.732469` | 5,000 | a•••+renoxis@apixis.dev | Awad (Renoxis QA) |
| `qa-rx3-1790128653.088279` | 5,000 | a•••+renoxis@apixis.dev | Awad (Renoxis QA) |

## Shared Anthropic key — 2026-10-04 (Developer Bot)
On Awad's ask, every project's `ANTHROPIC_API_KEY` in Vercel is now set to one shared key (production, preview, development), and each project's production was redeployed (all READY). 22 projects: aidaroosholding, apixis-dev, apixis-wallet, awad-command, awadbot, contraxis-dev, deduxis, halaxis, launchixis, lyrixis, nurserytoons, ominix, personalcontentbot, pinixis, qahwahworld, rawixis, recovra, renoxis, socixis, spatial-dashboard, wattixis, workspace. Existing entries were updated in place (Socixis branch-scoped preview entries kept); entries already marked Sensitive stay Sensitive because Vercel cannot change their type. Missing development (and Socixis all-branch preview) entries were added as Encrypted. `ANTHROPIC_MODEL` and other variables unchanged. Undo: set the old key back in Vercel for the project, then redeploy.

## Launch-prep pass — 2026-10-02 late night (Claude)

**Merged and deployed (Vercel deploys each `main` automatically):**
- **Ominix #6** (Codex): human services + jobs feed, comments, location filters, private requests, and the **Complete
  order** button. Its database change is **live** (Supabase `iwhvzfplvczqqxmhfkpa`), plus one tightening: signed-in users
  can only change a job's `status` directly. Security advisors: only known items.
- **Starter Ixis wording = 1,000** everywhere (was "200" on 9 repos; Apixis.dev really grants 1,000 — D11):
  Socixis #54, Lyrixis #20, qahwahworld #17, Recovra #19, Apixis.dev #63, Wattixis #9, NurseryToons #13, Geoxis #13, Ominix #8.
- **Socixis #54** also: CEO-brief Cixy follows the family greeting rule (match the greeting, never open with salaam);
  recorded platform cut 5% (D12).
- **Wattixis #10:** three live bugs fixed — Save draft never opened the draft, Cixy replies were blank, Delete draft
  stayed on screen (async calls not awaited). Tests 22/22 (9 were failing). Wattixis now has CI like every other site.

**Checked:** no failed builds on any real site (only the duplicate Contraxis copy fails); no leftover test endpoints.
Vercel runtime logs are not readable with the connector (403) — use the dashboard if a site misbehaves.

**PRs:** 51 stale/superseded PRs closed with a one-line reason (branches kept). **Still open — Awad's call:**
"Other Ixis companies" footer links on 12 sites (Wallet #21, Apixis.dev #57, Socixis #46, Renoxis #32, Recovra #13,
Rawixis #23, Deduxis #10, Lyrixis #14, Halaxis #12, qahwahworld #11, NurseryToons #8, Geoxis #7) — design, say
"merge footers"; Socixis #47 and Apixis.dev #58 (launch copy/visual fixes, pending your review); Apixis.dev #59
("do not merge" until you review); Lyrixis #16 (Release Tool — new paid feature); Contraxis #21 (insurance-claims
feature draft); Ominix #1 (Codex Cixy avatar, still says "Nexxis"); awad-command #17 (Daily AI Host draft).

**New for launch:** `docs/TESTER_MATRIX.md` (what to test, in order), `npm run launch:smoke` (every site up + sign-in
hands off to the Wallet), `docs/legal/TERMS_DRAFT.md` + `PRIVACY_DRAFT.md` (drafts for a lawyer, not published).
Daily health-check routine created (7:47am Central) — it needs Vercel/Supabase/GitHub attached in claude.ai → Routines.

**Blocked for Claude (needs Awad in the dashboard):** deleting Vercel projects `aw-live`,
`temporary-turbo-sienna-p6yqsjd`, `contraxis-design-demo`, `workspace` (none used by any code or domain — checked), and
removing env vars (the connector can't delete).

## Live cross-check — 2026-10-02 night (Claude, read from Vercel + Supabase + GitHub)

This replaces every earlier "what is missing" list. Re-check any time with `npm run launch:check` (docs/LAUNCH_KIT.md).

**Deploys:** every Vercel project runs the latest `main` of its repo (checked commit by commit). Pinixis was two
merges behind (not connected to GitHub; one hand upload had failed) — redeployed from `main` (`5102a50`), READY.

**Wallet clients (Apixis ID + Wallet keys):** 16 active, one per name: apixis, contentbot, contraxis, deduxis, geoxis,
halaxis, launchixis, lyrixis, nurserytoons, ominix, qahwahworld, rawixis, recovra, renoxis, socixis, wattixis
(ominix + wattixis registered 2026-10-02 late night). All `require_sso=false` until sign-in is verified live.

**Filled by Claude 2026-10-02 late night via the Vercel connector (names only; values never written down):**

| Vercel project | Added | How |
|---|---|---|
| `ominix` | `WALLET_API_KEY`, `APIXIS_CLIENT_ID`, `APIXIS_WALLET_API_URL` | New Wallet key minted (prefix `apx_live_IH-`), hash stored in the Wallet DB |
| `wattixis` | `WALLET_API_KEY`, `APIXIS_CLIENT_ID`, `APIXIS_WALLET_API_URL` | New Wallet key minted (prefix `apx_live_gtC`) |
| `halaxis`, `personalcontentbot` | `CRON_SECRET` | Freshly generated |
| `launchixis` | `ADMIN_EMAILS` | Awad's two addresses |
| `pinixis` | `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | Same keys Deduxis uses (copied project to project) |
| `pinixis` | `ADMIN_EMAIL` | awad@apixis.dev |

All six projects were redeployed from their current `main` build so the new values are live.

**Still missing — only Awad can supply these (names only):**

| Company (Vercel project) | Missing | Effect until set |
|---|---|---|
| Recovra (`recovra`) | `SUPABASE_SERVICE_ROLE_KEY` (or run the launch kit with a Supabase token) | Paid plans can't activate |
| Lyrixis (`lyrixis`) | `REDIS_URL`, `TRANSCRIPTION_API_KEY` | Upload → transcript off |
| Apixis.dev (`apixis-dev`) | `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or Upstash) | World/citizen state not durable |
| Halaxis (`halaxis`) | `TAVILY_API_KEY` | Research off |
| PersonalContentBot (`personalcontentbot`) | `PCB_DURABLE_JOBS` (after hub `pcb_jobs_durable.sql`) | Retry-safe jobs off |
| Pinixis (`pinixis`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ Stripe Connect on) | Payments say "not set up yet" |
| Everyone else | — | Complete |

**How the family connects (checked live 2026-10-02 late night, all match):**
- Sign-in return addresses in the Wallet DB (`wallet_api_clients.redirect_uris`) match each site's live address:
  apixis.dev, renoxis.dev, socixis.dev (+www), and `<name>.vercel.app` for the rest, except Recovra
  (`recovra-three.vercel.app`), Contraxis (`contraxis-dev.vercel.app`), Ominix (`ominix-app.vercel.app`), Geoxis
  (`spatial-dashboard-xi.vercel.app`), ContentBot (`personalcontentbot.vercel.app`).
- The Wallet's checkout "return to site" list (`lib/checkout/return-url.ts`) covers every one of those hosts; Geoxis's host
  is now in the code list too (it was only in the `CHECKOUT_RETURN_HOSTS` env var).
- Apixis.dev's "Enter" list (`apixis.dev/js/apixis-clients.js`) points at the same addresses.
- Pinixis is not a Wallet client (own Stripe, D17); its address is `pinixis.vercel.app` until pinixis.com is pointed at it.

**Supabase:** Deduxis receipts + Pinixis marketplace schemas live (2026-10-02). Still Awad's (or the kit's): hub lint SQL,
hub `pcb_jobs_durable.sql`, Pinixis sign-up trigger (optional), leaked-password protection (Pro plan).

### Duplicates / leftovers found (cleanup needs Awad's yes — nothing deleted)
1. Vercel project **`aw-live`** — second deploy of the ApixisWallet repo with **zero env vars**; builds on every merge. Delete.
2. Vercel project **`temporary-turbo-sienna-p6yqsjd`** — second deploy of contraxis.dev, **fails every merge**. Delete.
3. Vercel projects **`contraxis-design-demo`**, **`workspace`** — not linked to a family repo, idle since September. Delete if unused.
4. **`APIXIS_WALLET_API_KEY`** (old shared Wallet secret) still set beside the per-site `WALLET_API_KEY` on 12 projects. The SDK
   uses `WALLET_API_KEY` first, so it is unused; remove it everywhere when legacy access is switched off (step "flip SSO").
5. **`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`** copies on sites where Stripe is off by rule (D14): Contraxis, Socixis, Lyrixis,
   Rawixis, Recovra, Halaxis, Launchixis, ContentBot, NurseryToons, awad-command (+ old `STRIPE_PRICE_*`). Unused secrets; remove.
6. Socixis: five branch-only `ANTHROPIC_API_KEY` copies for old `cursor/*` preview branches. Remove.
7. Docs: `docs/MORNING_BRIEF_2026-10-01.md` and per-repo `LAUNCH_NOTES.md` key lists are archives — the only owner to-do is
   `docs/OWNER_CHECKLIST.md`, the only status is this board.

### Still Claude's after keys are in (on Awad's go)
`require_sso=true` per site, `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`, remove item 4, live tester matrix.

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
