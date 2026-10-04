# Claude notes (Apixis Wallet)

Dated notes from Claude (Claude Code), same purpose as `NOTES/GROK.md`: what Claude checked or changed here, what it found, what is still open and who owns it. The one family status board stays `docs/FAMILY_STATUS.md`.

## 2026-10-04 (UTC) — Claude: full-portfolio review (read-only; this note, the AI_CHANGELOG line and a FAMILY_STATUS section are the only changes)

Awad asked for all 24 repos to be read twice and for a plain status: what is done, what is not, what Claude can do, what only Awad can do. This is the Wallet's slice. Family-wide findings: `docs/FAMILY_STATUS.md` → "Full-portfolio review — 2026-10-04".

### Snapshot
- Reviewed `main` @ `cf0c526` (#38). While reading, Grok merged #39 (feed tip minimum), #40 (feed key), **#41 welcome grant + migration 013**, #42 (notes) → `main` is `5aba8ef`. The local checks below ran on `cf0c526`.
- Vercel `apixis-wallet` production READY on the latest main. Duplicate project **`aw-live`** builds this same repo with zero env vars on every merge (Awad: delete).
- Supabase `kzneeksminozmhnqaaun` tracked migrations: 007, 008, 009, 010, 011 marketplace_orders, 012 unique_active_client_name, **013_signup_grant (applied 22:37Z)**. 001–006 predate tracking.

### Verified this session
- `npm run lint`, `typecheck`, `test` (16 files) and `build`: all pass on Node 22. `test:sql` not run here (needs a Postgres; CI runs it on postgres:16 and is green).
- Live DB, read-only SELECTs: money functions executable by anon/authenticated = **0 rows** ✓. `wallet_api_clients` = 16 active, **all `require_sso=false`**. Ledger = QA only: purchase 17 rows (09-22 → 09-28), refund 2, reserve 21, spend 15, release 6; no purchase after 09-28. 13 wallets, 11 entitlements (all active), 23 auth users (16 `@apixis.dev`), 6 `sso_links`. No real customer activity yet.
- Security advisors: no ERROR. WARN: leaked-password protection OFF (Pro-plan toggle, Awad). INFO: RLS-no-policy on `audit_events`, `sso_codes`, `sso_links`, `wallet_api_clients` = intentional deny-all.
- SDK copies on the 14 TypeScript sites: `apixis-wallet.ts`, `apixis-redirect.ts`, `apixis-cixy.ts` are byte-identical to `sdk/` ✓. `apixis-login-next.ts`: 10 identical; Launchixis (extra env fallbacks) and Rawixis (`lib/supabase/admin.ts` key isolation) differ on purpose. Geoxis, Wattixis and Apixis.dev carry hand-written JS ports that differ from each other: there is no canonical `sdk/apixis-wallet.js` / `sdk/apixis-login.js`.
- `lib/checkout/return-url.ts` still lists `socixis.vercel.app`, `geoxis.vercel.app` (not Geoxis's host) and `nexxis-tau.vercel.app`. Harmless, misleading.

### Done (live)
Ledger + hardening (007), legal audit log (008), Apixis ID SSO (009, 012), idempotent hold release (010), marketplace orders + 5% settle (011), welcome grant OFF by default (013), Stripe checkout + webhook, per-site keys (16 clients), burst rate limits, SDK v3.1 + login/redirect/cixy kits, launch kit (`npm run launch`, `launch:check`, `launch:smoke`), tester matrix, Terms/Privacy drafts, WalletScreen on real data, login/reset pages, Companies tab, CI (app + SQL).

### Open — needs Awad (only you can)
1. Anthropic credits; a Vercel token and a Supabase access token for `npm run launch`.
2. Stripe: live restricted key, the 4 price IDs, webhook `https://apixis-wallet.vercel.app/api/webhooks/stripe` with the 5 events.
3. Vercel env on `apixis-wallet`: confirm `CRON_SECRET`, `TERMS_VERSION`, `WALLET_STATS_KEY` are set (Grok's 09-25 name check found `WALLET_STATS_KEY` missing; AGENTS §8 item 4 is still unchecked).
4. Delete Vercel projects `aw-live`, `temporary-turbo-sienna-p6yqsjd`, `contraxis-design-demo`, `workspace`.
5. Supabase: leaked-password protection on every project; run `docs/security/2026-09-30-hub-project-lint.sql` on the hub `myfclypikkcvfurkbzmj` (its advisors still show `handle_new_user` / `rls_auto_enable` callable by anon).
6. Terms/Privacy: lawyer → publish → set `TERMS_VERSION`.
7. Decide: PR #21 footer; the `SIGNUP_GRANT_ENABLED` cutover (1,000 free spendable Ixis = $10 of family credit per new Apixis ID; rate limits exist, bonus expiry is still not enforced).
8. Run the tester matrix (`docs/TESTER_MATRIX.md`): "Runs: none yet".

### Open — Claude can do on your go
- After keys: `require_sso=true` per client, `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` + rotate the Wallet service key, remove `APIXIS_WALLET_API_KEY` from the 12 site projects, run the matrix.
- Add canonical `sdk/apixis-wallet.js` + `sdk/apixis-login.js` so the three JS sites stop carrying forks (D10).
- Doc drift: AGENTS.md header "Last updated 2026-09-23" and §6 ("WalletScreen is hard-coded demo" — it is not any more); README "still shows demo data" and "migrations 001–007"; `return-url.ts` dead hosts; the 09-30 AI_CHANGELOG entry names a hub ref that does not exist (`myfclypikkcvfurrlsko`; the hub is `myfclypikkcvfurkbzmj`).
- Still not built (AGENTS §9): owner admin dashboard, low-balance notices, auto-renewing subscriptions, bonus expiry, durable rate limiting / WAF rules.

### Process drift seen
- D15 says `WORKBOARD.md` and `NOTES/*.md` are archives; Grok keeps updating both (10-04). Awad asked today for the notes in every repo to be updated, so this file exists. D15's wording should be settled one way or the other.
