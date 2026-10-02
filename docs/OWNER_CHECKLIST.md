# Awad's checklist (updated 2026-10-02, night)

Backend is done. Keys now go in through the **launch kit**: one file, one command (`docs/LAUNCH_KIT.md`).

## Step 1 — Get these (only you can)
- [ ] **Anthropic credits** (console.anthropic.com → Billing). Without them Cixy is "resting" on every site.
- [ ] **Vercel token** (Vercel → Account Settings → Tokens).
- [ ] **Supabase access token** (Supabase → Account → Access Tokens).
- [ ] The keys listed in `ApixisWallet/.env.launch.example` (each line says where to get it). Missing some?
      Fine — run the kit now and again later.

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
- [ ] **Contraxis:** delete the duplicate Vercel project `temporary-turbo-sienna-p6yqsjd`.
- [ ] **Pinixis:** create its Vercel project (connected to the `pinixis` repo) if it doesn't exist yet; set its domain.
- [ ] Optional: Google OAuth client for Renoxis (redirect `https://renoxis.dev/api/connections/google/callback`),
      Meta app for Socixis.

## Step 4 — Test one thing per company (5 minutes each)
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
| Ominix | Award a bid → complete → seller gets amount − 5% |
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
- Ominix: merge Codex's job-feed branch? A "Complete order" button (backend ready).
- Wattixis: what it sells; Codex's draft-UI work from your Mac.
- Terms / Privacy pages with a lawyer (Claude can draft).
- ~70 old PRs: say "close them".

## Done by Claude on 2026-10-02
- Wallet: key script can't re-mint (that would have broken sign-in everywhere); the database enforces it.
- Deduxis: receipts database + private storage created (uploads were impossible); support form no longer crashes.
- Pinixis: full database live; a stock-changing function locked down; payments say "not set up yet" until Stripe keys.
- Every repo: `.env.example` lists every key the code reads.
- Launch kit built and tested.
