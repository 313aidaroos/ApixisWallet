# Awad's checklist — one company at a time (2026-10-02)

Everything here is **yours** to do (keys, dashboards, decisions). Backend code is done and on `main`.
Where it says "Vercel env", that means: Vercel → that project → Settings → Environment Variables →
Production → add → **Redeploy**. Never paste a key anywhere except Vercel / Supabase.

Status board: `docs/FAMILY_STATUS.md`. Rules: `AGENTS.md` §0.

---

## 0. Before anything else (family-wide, once)

1. **Anthropic credits** — top up console.anthropic.com. Until then Cixy says "resting" on every site.
2. **The shared `ANTHROPIC_API_KEY`** — have it ready; most sites below need it.
3. **Leaked-password protection** — Supabase → each project → Authentication → Passwords → ON.
   17 projects: wallet, hub ("313aidaroos's Project"), socixis, lyrixis, recovra, deduxis, rawixis, halaxis,
   contraxis, ominix, wattixis, geoxis, launchixis, nurserytoons, renoxis, pinixis.
4. **Hub project SQL** (Supabase → "313aidaroos's Project" `myfclypikkcvfurkbzmj` → SQL editor; my connector cannot write there):
   - paste `ApixisWallet/docs/security/2026-09-30-hub-project-lint.sql` → Run.
   - paste `PersonalContentBot/supabase/pcb_jobs_durable.sql` → Run.

> **Wallet keys: the old morning-brief instruction `npm run family-keys` (all sites) was WRONG.** It would have
> given every already-working site a duplicate key and broken "Sign in with Apixis" everywhere. Fixed: the
> script now refuses without `--only`, and the database refuses duplicates (migration 012, live).
> **14 sites already have keys. Only Ominix and Wattixis need new ones** (step 1 below).

---

## 1. Apixis Wallet (`apixis-wallet` Vercel · Supabase `kzneeksminozmhnqaaun`)
1. Terminal: `cd ApixisWallet && npm install && npm run family-keys -- --only ominix,wattixis`
2. Copy the printed SQL → Supabase **apixis-wallet** → SQL editor → Run.
3. Keep the printed env lines open — they go into Ominix and Wattixis (sections 14 and 15).
4. Vercel env (check they exist): `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, the `STRIPE_IXIS_*_PRICE_ID`s,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TERMS_VERSION`.
5. Test: buy the Spark pack with Stripe test card `4242 4242 4242 4242` → balance +1,000.
6. **Later, after every site signs in fine:** tell me "flip SSO". I set `require_sso=true` per site,
   you set `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` in Vercel, then we rotate the old secret.
7. Terms / Privacy pages: you + a lawyer. I can draft them.

## 2. Apixis.dev (hub · Supabase hub project)
1. Vercel env: `ANTHROPIC_API_KEY`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL/TOKEN`),
   `CITIZEN_TOKEN_SECRET` (long random), `WORLD_PULSE_SECRET` (long random), `CRON_SECRET`,
   `APIXIS_WORLD_KEYS` (hashes of each site's world key), `RESEND_API_KEY`, `WALLET_API_KEY` (already exists).
2. Optional: `PLAID_CLIENT_ID/SECRET/ENV` (only if you want bank linking).
3. Leave Stripe checkout off (it answers 410 by design — Ixis are bought in the Wallet).
4. Decide: Juno's `juno/backend-complete-2026-10-01` branch is **docs only** → merge or close.
5. Close PRs #58/#59 (#59 = do not merge).

## 3. Renoxis (`renoxis.dev`)
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
   (Google Cloud → OAuth client), `CONNECTION_ENCRYPTION_KEY` (32+ random chars; never change it after).
2. Wallet key: already registered — nothing to do.
3. Test: Apixis sign-in → buy seat → refresh → still has access.

## 4. Socixis (`socixis.dev`)
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `TOKEN_ENC_KEY` (random, never change),
   `META_APP_ID` / `META_APP_SECRET` / `META_LOGIN_CONFIG_ID` (Meta developer app), `RESEND_API_KEY`, `CRON_SECRET`.
2. Optional (video/image features): `XAI_API_KEY`, `HEYGEN_API_KEY`, `DID_API_KEY`, `RUNWAY_API_KEY`, `REPLICATE_API_TOKEN`.
3. Leave `STRIPE_*` empty — the webhook is off on purpose (D14).
4. Decide: Juno branch (docs only) merge/close; PRs #47/#48.
5. Test: Apixis sign-in → unlock a skin.

## 5. Contraxis (`contraxis-dev`)
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`. Leave `STRIPE_*` empty (webhook off, D14).
2. **Delete** the duplicate Vercel project `temporary-turbo-sienna-p6yqsjd` (wrong root, fails every PR).
3. Decide: Juno branch merge/close (its SQL is already live — nothing to run).
4. Test: Apixis sign-in → pro seat.

## 6. Recovra
1. Vercel env: **`SUPABASE_SERVICE_ROLE_KEY`** (Supabase `ewvgpfufzeyzyutjxuoh` → Settings → API) — paid plans
   do not activate without it. `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `RESEND_API_KEY`.
2. Legal footer: `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_ADDRESS`, `NEXT_PUBLIC_LEGAL_EMAIL`, `NEXT_PUBLIC_GOVERNING_LAW`.
3. Test: Apixis sign-in → paid plan → receipt shows.

## 7. Deduxis
1. ~~Database~~ **done today by me**: the receipts tables + private file storage were missing (uploads would
   have failed). Created live with owner-only security.
2. Vercel env: `ANTHROPIC_API_KEY` (it reads the receipts), `APIXIS_WORLD_KEY`, `RESEND_API_KEY`.
3. Test: Apixis sign-in → buy seat → upload a receipt photo → it appears → export CSV.

## 8. Lyrixis
1. Vercel env: `REDIS_URL` (Upstash/Redis), `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `RESEND_API_KEY`.
2. Upload → transcript needs a worker host + `TRANSCRIPTION_API_KEY` — your call which provider.
3. Test: one real upload.

## 9. Rawixis
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `RESEND_API_KEY`.
2. Fee ledger table: already live in the hub project — nothing to run.
3. Test: buyer seat via Apixis; one end-to-end deal.

## 10. Qahwah World
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `RESEND_API_KEY`.
2. Physical coffee keeps its own Stripe (the D14 exception): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`.
3. Decide: seller seat / featured listing — sell them or leave unused.

## 11. Halaxis
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `TAVILY_API_KEY` (search), `CRON_SECRET`.
2. Keep `ENABLE_PAYMENTS` **off**. Nothing to sell yet — your call on products.

## 12. Launchixis
1. Vercel env: `ANTHROPIC_API_KEY`, `ADMIN_EMAILS` (your email).
2. Sales are off by design (answers "not on sale"). Turn on only when you decide.

## 13. PersonalContentBot
1. After step 0.4 (durable jobs SQL): Vercel env `PCB_DURABLE_JOBS=true` + `CRON_SECRET` (long random).
2. `ANTHROPIC_API_KEY`, `XAI_API_KEY` (video).
3. Test: render one clip → retry the same click → charged once.

## 14. Ominix
1. Vercel env: the 3 lines printed in step 1 (`WALLET_API_KEY`, `APIXIS_CLIENT_ID=ominix`, `APIXIS_WALLET_API_URL`)
   — **bids cannot be awarded without them**. Plus `APIXIS_WORLD_KEY`, `CRON_SECRET`.
2. Leave `STRIPE_*` empty (Ixis only, D13).
3. Design: add a "Complete order" button that posts to `/api/orders/complete` (backend ready).
4. Decide: merge Codex's `codex/human-services-jobs-feed` branch? If yes, tell me and I apply its migration.
5. Test: award a bid → complete → seller gets amount − 5%.

## 15. Wattixis
1. Vercel env: the 3 lines from step 1 (`APIXIS_CLIENT_ID=wattixis`), plus `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (`cbmxhwdysfcbxbdqfjvx`).
2. Codex: land the async draft UI work from your Mac (8 UI tests red until then).
3. Decide: what Wattixis sells.

## 16. Geoxis
1. Vercel env: `APIXIS_WORLD_KEY`. Plans are off (`PLANS_ON_SALE=false`) until you decide.

## 17. NurseryToons
1. Vercel env: `ANTHROPIC_API_KEY`, `APIXIS_WORLD_KEY`, `OWNER_ADMIN_EMAIL`. Family plan paused — your call.

## 18. Pinixis (new, 2026-10-01)
1. Supabase `jxtzdylmkulhbvpmkwsp`: only the arcade migration is live. The main `supabase/schema.sql`
   (profiles, build requests, quotes, payments, sellers, listings, orders) is **not** — say go and I apply it.
2. **Decision first:** Pinixis takes card payments through its own Stripe. Family rule D14 says only the Wallet
   runs Stripe (qahwahworld's physical coffee is the one exception). Physical builds = second exception? Yes/no.
3. Then Vercel env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `FACTORY_EMAILS`, `QUOTES_EMAIL`, `SUPPORT_EMAIL`.
4. Not yet a Wallet client; add with `npm run family-keys` once its domain is set (I add it to the list).
5. Legal review (selling physical goods).

## 19. AwadBot
1. Stays off (`AWADBOT_ON_SALE=false`). Alpaca keys only in Vercel. **No AI ever places trades.**

## 20. awad-command (internal)
1. Vercel env as needed: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` + `CIXY_VOICE_ID`, `RESEND_API_KEY`,
   `LEAD_INBOUND_WEBHOOK_SECRET`, `LEAD_MESSAGE_WEBHOOK_SECRET`, `CRON_SECRET`, `ALLOWED_EMAIL`. Alpaca = paper only.

## 21. Housekeeping (whenever)
- ~70 stale PRs: say "close them" and I close each with a one-line note.
- Network: to let me test the live sites, allow `*.vercel.app` + your domains in this Claude environment's network settings.
