# Awad's checklist (updated 2026-10-02, late night)

Backend is done. Keys now go in through the **launch kit**: one file, one command (`docs/LAUNCH_KIT.md`).

## Step 1 — Get these (only you can)
- [ ] **Anthropic credits** (console.anthropic.com → Billing). Without them Cixy is "resting" on every site.
- [ ] **Vercel token** (Vercel → Account Settings → Tokens).
- [ ] **Supabase access token** (Supabase → Account → Access Tokens).
- [ ] Only these are still missing (checked live 2026-10-02 late night; table in `docs/FAMILY_STATUS.md`):
      Redis URL + transcription key for Lyrixis, Upstash/KV for Apixis.dev, a Tavily key for Halaxis, Pinixis Stripe keys,
      and Recovra's Supabase key (or just give the kit your Supabase token). Claude already set Ominix/Wattixis Wallet keys,
      cron secrets, Launchixis admins, and Pinixis Anthropic/Resend/admin email. Put what you have in `.env.launch`.

## Step 2 — Run the kit (on your Mac)
```bash
cd ApixisWallet && git pull && npm install
cp .env.launch.example .env.launch     # fill it in
npm run launch:check
npm run launch
npm run launch:check                   # until it says every company is ready
```
The kit also does what used to be separate steps: hub SQL, leaked-password protection, Ominix + Wattixis
Wallet keys, every site's world key, ContentBot durable jobs, Supabase keys, redeploys.

## Step 3 — Dashboard steps the kit can't do
- [ ] **Stripe webhooks** (Stripe → Developers → Webhooks → Add endpoint), then put each signing secret in `.env.launch`:
  - Wallet: `https://apixis-wallet.vercel.app/api/webhooks/stripe` (events: `docs/LAUNCH_NOTES.md`)
  - Qahwah World (coffee): `https://qahwahworld.vercel.app/api/stripe/webhook`
  - Pinixis: `https://<pinixis domain>/api/stripe/webhook` — and turn on **Stripe Connect** (sellers get paid out)
- [ ] **Pinixis:** point pinixis.com at the `pinixis` Vercel project when ready (it now deploys from GitHub `main`).
- [ ] **Cleanup (2 minutes, only you can — Claude's delete was blocked):** Vercel → each project → Settings → bottom →
      Delete: `aw-live`, `temporary-turbo-sienna-p6yqsjd`, `contraxis-design-demo`, `workspace` (Claude checked: no
      code or domain uses them). Optional: remove `STRIPE_*` on Stripe-off sites (list in `docs/FAMILY_STATUS.md`).
- [ ] **Daily health check:** claude.ai → Routines → "Apixis family daily health check" → attach Vercel, Supabase,
      GitHub and the ApixisWallet repo (it was created without them, so it can't check anything yet).
- [ ] **Design calls waiting on you** (open PRs): footer "Other Ixis companies" on 12 sites (say "merge footers"),
      Socixis #47, Apixis.dev #58/#59, Lyrixis #16 Release Tool, Contraxis #21, Ominix #1, awad-command #17.
- [ ] Optional: Google OAuth client for Renoxis (redirect `https://renoxis.dev/api/connections/google/callback`),
      Meta app for Socixis.

## Step 4 — Test one thing per company (5 minutes each; full list: `docs/TESTER_MATRIX.md`, quick check: `npm run launch:smoke`)
| Company | Test |
|---|---|
| Wallet | Buy the Spark pack → balance +1,000 |
| Renoxis | Sign in with Apixis → buy seat → refresh → still has access |
| Socixis | Sign in with Apixis → unlock a skin |
| Contraxis | Sign in with Apixis → pro seat |
| Recovra | Sign in with Apixis → paid plan → receipt shows |
| Deduxis | Buy seat → upload a receipt photo → it appears → export CSV |
| Lyrixis | Upload a song → transcript (needs `REDIS_URL` + transcription key + a worker host) |
| Rawixis | Buyer seat via Apixis |
| Ominix | Post a job → second account quotes → hire → **Complete order** → seller gets amount − 5% |
| ContentBot | Render a clip → click again → charged once |
| Pinixis | Request a build → pay the deposit by card; list an item → buy it |
| Any site | Ask Cixy something |

Then tell Claude "keys are in": it flips `require_sso`, retires the old shared Wallet secret and runs the
full tester matrix (allow `*.vercel.app` + your domains in this Claude environment's network settings so
it can reach the live sites).

## Decisions on record (AGENTS.md §0c)
D11 starter 1,000 Ixis · D12 fee 5% · D13 Ominix Ixis-only · D14 Stripe only in the Wallet, except
**coffee (qahwahworld)** and **Pinixis (D17, decided 2026-10-02)** · AwadBot stays off, no AI trading.

## Still your call (no rush)
- Halaxis / Launchixis / Geoxis / NurseryToons: what to sell (all intentionally off).
- Wattixis: what it sells; Codex's draft-UI work from your Mac.
- Terms / Privacy: drafts ready in `docs/legal/` — send to a lawyer, then Claude publishes and bumps `TERMS_VERSION`.

## Done by Claude on 2026-10-02
- Wallet: key script can't re-mint (that would have broken sign-in everywhere); the database enforces it.
- Deduxis: receipts database + private storage created (uploads were impossible); support form no longer crashes.
- Pinixis: full database live; a stock-changing function locked down; payments say "not set up yet" until Stripe keys.
- Every repo: `.env.example` lists every key the code reads.
- Launch kit built and tested.
- Late night: filled every missing setting that didn't need a new account (list in `docs/FAMILY_STATUS.md`), redeployed those 6 sites, and checked every sign-in/return address matches.
- Late night (2): Ominix jobs feed + Complete order merged and live; "1,000 starter Ixis" wording fixed on 9 sites;
  Wattixis Save-draft / Cixy / Delete bugs fixed; 51 old PRs closed; tester matrix, smoke test, Terms/Privacy drafts.
