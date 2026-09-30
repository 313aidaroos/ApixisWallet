# Morning brief — 2026-10-01 (Claude, overnight pass)

Everything below is merged to `main` and deployed by Vercel on merge. What is left is **keys, a few SQL pastes, and cosmetics**. Family board: `docs/FAMILY_STATUS.md`. Every repo's `AI_CHANGELOG.md` has tonight's entries.

## 1. What changed overnight (33 PRs merged, all CI green where CI exists)

| Area | Done |
|---|---|
| Sign-in bug at the source | `verifyOtp({ type: "email" })` in the Wallet + every site's login kit; first sign-in for a new address works everywhere (Deduxis, Wattixis, Geoxis, NurseryToons callbacks too). |
| One SDK / one login kit / one world kit | Byte-identical copies from `ApixisWallet/sdk` in every TS site; JS ports updated (Apixis.dev, Geoxis, NurseryToons). SDK v3.1 adds marketplace orders. |
| Wallet hardening | Burst rate limits on reserve / redeem / SSO token (429 + Retry-After). Tape tab no longer shows asset-style "Cap / 24h vol". |
| **Ominix is Ixis-only (D13)** | Buyer's Ixis are held in the Wallet when a bid is awarded, seller is paid amount − 5% when the order completes. Wallet migration 011 and Ominix migration 002 **applied live and verified**. NXC functions revoked, not deleted. |
| Stripe outside the Wallet (D14) | Contraxis + Socixis webhooks answer 410; code kept. |
| Starter Ixis = 1,000 (D11), fee = 5% (D12) | Apixis.dev defaults, copy, docs, tests; Ominix `award_job`. |
| **One Cixy (D15/CIXY.md)** | `sdk/apixis-cixy.*` = the shared persona core; 11 sites build their prompt on it (only the product role is site-specific). Greeting rule: match the person, never open with salaam. When the brain is down (no key / out of credit / 429) every route answers a calm sentence, never a vendor error. |
| Owner = Apixis ID `sub` first | Deduxis, Geoxis, NurseryToons, Apixis.dev redeem paths. Idempotency bugs fixed (Apixis.dev `Date.now()` key, NurseryToons key without user). |
| Wattixis APIs | `drafts` / `listings` / `requests` validate every field; ownership enforced in code + RLS (verified live). |
| ContentBot durable jobs | Retry of the same click never renders/charges twice; reconcile cron releases stuck holds (needs SQL + 2 env vars below). |
| Security | Advisors run on all 15 Supabase projects. Trigger functions no longer callable via RPC and `search_path` pinned on Contraxis, Lyrixis, Ominix (applied). Hub project needs your paste (below). No ERROR-level findings anywhere. |
| CI | Shared CI now on Node 22; CI added to Deduxis, Renoxis, Socixis, Contraxis, AwadBot, Geoxis (they had none on `main`); `typecheck` scripts added where CI was silently skipping type checks (that hid a real build break in ContentBot — fixed). |

## 2. Your checklist (in this order)

### A. Wallet keys — one command
```bash
cd ApixisWallet && npm install && npm run family-keys
```
It prints (1) one SQL block → paste into Supabase **apixis-wallet** (`kzneeksminozmhnqaaun`) SQL editor, (2) three env lines per site. It now covers **Halaxis, Ominix, Wattixis** too. Keys are printed once; never paste them anywhere but Vercel.

### B. Vercel env vars per project (Settings → Environment Variables → Production, then Redeploy)

Every family site needs these three from step A:
`WALLET_API_KEY`, `APIXIS_CLIENT_ID=<site name>`, `APIXIS_WALLET_API_URL=https://apixis-wallet.vercel.app`

| Vercel project | Extra vars this site reads (set the ones you have) |
|---|---|
| apixis-wallet | `CRON_SECRET`, `TERMS_VERSION`, (later) `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` |
| ominix | the three above (**new** — Ominix cannot award a bid until they exist), `APIXIS_WORLD_KEY` |
| wattixis | `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (no Wallet/Apixis ID code yet — see §5) |
| halaxis | the three above (new), `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY` |
| personalcontentbot | `PCB_DURABLE_JOBS=true` **after** SQL C2, `CRON_SECRET` (any long random string) |
| recovra | `SUPABASE_SERVICE_ROLE_KEY` (Codex validated it; never configured) |
| lyrixis | `REDIS_URL`, `TRANSCRIPTION_API_KEY` (upload path + worker; both absent today) |
| every site with Cixy | `ANTHROPIC_API_KEY` — **and Anthropic credits**: Rawixis/Recovra report "insufficient credits"; until topped up Cixy answers "resting" everywhere the key is shared |
| every site with the world kit | `APIXIS_WORLD_KEY` (per-product key; hashes in `APIXIS_WORLD_KEYS` on apixis-dev) |

### C. Two SQL pastes (Supabase → project "313aidaroos's Project", ref `myfclypikkcvfurrlsko`)
My connector has no write access to that one project.
1. `ApixisWallet/docs/security/2026-09-30-hub-project-lint.sql` — advisor fixes (trigger functions off the RPC surface, `search_path`).
2. `PersonalContentBot/supabase/pcb_jobs_durable.sql` — durable job columns. Then set `PCB_DURABLE_JOBS=true` (B).

### D. One dashboard toggle, 15 times
Supabase → each project → Authentication → Passwords → **Leaked password protection: ON**. It is the only advisor warning left on most projects and cannot be set by SQL.

### E. When keys are in, tell me and I will
- flip `require_sso=true` per site and `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`, then rotate the Wallet secret;
- run the tester matrix (Wallet buy → redeem on Renoxis/Socixis/Contraxis → retry → Ominix award → complete) — **this environment's network policy blocks the production hosts** (`*.vercel.app`, `apixis.dev`, `renoxis.dev`, `socixis.dev`, `contraxis.dev`); add them to the environment's allowed domains or I test through Supabase only.

## 3. Verified tonight (what "green" means here)
- Local: lint 0 errors, tsc 0 errors, all test suites passing and `next build` succeeding on every TS repo after the merges (second pass on merged `main`).
- GitHub: CI green on `main` for every repo that has CI. Vercel "Deployment has completed" on every merged commit.
- Supabase: migrations 011 (Wallet) and 002 (Ominix) verified by query; RLS verified on Wattixis tables; advisors re-run.
- Not verified (network-blocked): HTTP against the deployed sites. Nothing in the diff changed routing or env names except the additions listed in §2.

## 4. Decisions locked (AGENTS.md §0c) — every AI reads these
D11 starter 1,000 · D12 fee 5% everywhere · D13 Ominix Ixis-only, NXC deactivated not deleted · D14 non-Wallet Stripe paths deactivated not deleted · D15 one log (`AI_CHANGELOG.md`) + one board (`docs/FAMILY_STATUS.md`) · D16 `verifyOtp` type `email`.

## 5. Still open (not cosmetic, not keys)
| Item | Who | Notes |
|---|---|---|
| Wattixis draft UI tests (8 of 13 red on `main`) | Codex (uncommitted on your Mac) | `public/js/*` harness is sync, code is async. APIs are done and validated; CI held off this repo until that lands. |
| Wattixis Apixis ID + Wallet | Claude, next session | Site has no `/auth/apixis/*` routes or Wallet calls at all; needs the login kit ported to its plain-JS API style (~half a day). |
| Ominix "Complete order" control | You (design) | Backend `/api/orders/complete` is ready; no button posts to it. |
| Lyrixis upload → transcript | Keys first | `REDIS_URL` + worker host + `TRANSCRIPTION_API_KEY`, then one real upload. |
| Halaxis SKUs | Your call | Nothing to sell; payments intentionally off. |
| AwadBot | Your call | `AWADBOT_ON_SALE=false`; fulfilment TODO. Never run trading from an AI. |
| Terms / Privacy pages | You + counsel | I draft on request; not published without review. |
| ~70 stale PRs across repos | You | Superseded by tonight's merges; say the word and I close them with a one-line note each. |
| Contraxis duplicate Vercel project `temporary-turbo-sienna-p6yqsjd` | You (Vercel) | Wrong root; fails every PR status. Delete the project. |
