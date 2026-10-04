# Tester matrix — run when keys are in (2026-10-02)

Two layers. Run the first; if it is green, walk the second by hand (or Claude does it once this environment can reach
the live sites — allow `*.vercel.app` and the family domains in the environment's network settings).

## 1. Automatic (2 minutes, read-only, no money)
```bash
cd ApixisWallet && npm run launch:check   # every required Vercel setting present?
npm run launch:smoke                      # every site up, and "Log in with Apixis ID" hands off to the Wallet correctly
```

## 2. By hand — one person, one fresh email, in this order
Use a new address (e.g. `you+launch1@…`). Prices are in Ixis; buy the Spark pack first.

| # | Where | Do | Expect | Proof (Claude checks in the Wallet DB) |
|---|---|---|---|---|
| 1 | Any site → Log in with Apixis ID | Sign in by email link | Back on the site, signed in; Apixis world agent with **1,000** in-world Ixis | `auth.users` row; world agent on Apixis.dev |
| 2 | Wallet | Buy Spark pack (real card) | Balance +1,000 Ixis; checkout showed "final and non-refundable" | `credit_xp` keyed by the Stripe event id |
| 3 | Same browser, 2nd site | Log in with Apixis ID | **No new sign-up** — same account, same balance | one `auth.users` row |
| 4 | Renoxis | Buy a seat → refresh | Still has access; balance down by the seat price | reserve → capture, `entitlements.renews_at` = +30 days |
| 5 | Socixis | Unlock a skin | Unlocked; one charge | one capture per idempotency key |
| 6 | Contraxis | Pro seat | Pro features on | capture + entitlement |
| 7 | Recovra | Paid plan | Plan active, receipt shown | needs `SUPABASE_SERVICE_ROLE_KEY` on `recovra` |
| 8 | Deduxis | Seat → upload a receipt photo → export CSV | Photo appears in the list; CSV downloads | file in private `receipts` bucket under your user id |
| 9 | Lyrixis | Upload a song | Transcript appears | needs Redis + transcription key + worker |
| 10 | Rawixis | Buyer seat | Seat active | capture |
| 11 | Ominix (two accounts A, B) | A posts a request; B quotes; A hires; B delivers; A clicks **Complete order** | A's Ixis held at hire; B receives amount − 5% | `marketplace` order + `payout` audit row, fee = 5% |
| 12 | Ominix | B offers a service; A requests it privately | Only A and B see the private request | RLS (tested in CI too) |
| 13 | ContentBot | Render a clip; click again quickly | Charged once | one capture (needs `PCB_DURABLE_JOBS` for retry-safety) |
| 14 | Wattixis | Save a listing draft; ask Cixy "What is the 5% fee?" | Draft opens; Cixy answers | draft row (signed in) |
| 15 | Qahwah World | Roaster seat via Ixis; coffee by card | Seat via Wallet; coffee via its own Stripe | — |
| 16 | Pinixis | Request a build → pay deposit by card; list an item → buy it | Stripe checkout works; seller onboarding via Connect | needs Pinixis Stripe keys + webhook |
| 17 | Any site except Halaxis | Say "Hi" to Cixy | Plain friendly hello; no religious greeting or phrase; never calls itself a Muslim assistant | needs Anthropic credits |
| 18 | Wallet | Try to buy with a declined test card / cancel checkout | No Ixis added | no `credit_xp` |

## 3. After it passes (Claude, on Awad's "go")
- `require_sso=true` for each client, `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`, then remove the old shared
  `APIXIS_WALLET_API_KEY` from every Vercel project.
- Record the run (date, account used, pass/fail per row) at the bottom of this file.

## Runs
_(none yet)_
