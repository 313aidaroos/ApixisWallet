# Apixis family — status board (one page, every AI reads this first)

**Owner:** Awad (313aidaroos). **Rules:** `AGENTS.md` §0 (D1–D16). **Last updated: 2026-09-30 (Claude).**

This is the only family-wide status board. Per-repo `NOTES/*.md`, `JUNOAI_NOTES.md`, `WORKBOARD.md`
and `LAUNCH_NOTES.md` files are archives (D15). If you change family status, change it here.

## How the family works (the short version)

- **One cash register:** this Wallet. 100 Ixis = $1. Only the Wallet runs Stripe for Ixis. No refunds, no expiry, no cash-out.
- **One login:** Apixis ID. The Wallet's Supabase project is the identity provider; sites use `/sso/authorize` + `/api/sso/token`.
- **One SDK:** `sdk/apixis-wallet.ts` (v3), `sdk/apixis-login-next.ts`, `sdk/apixis-redirect.ts`. Sites carry byte-identical copies as `lib/apixis-*.ts`. Change here, then copy.
- **Redeem contract:** reserve → provision → capture (or release). `409 already_captured` = charged, keep access. Idempotency key `<app>:<key>`, 8–80 chars. Owner = Apixis ID `sub` first, verified email only as legacy.
- **World kit:** Apixis.dev `sdk/apixis-world*.ts` + `POST /api/agent/provision`. Every sign-up gets a wallet + avatar agent + 1,000 starter Ixis (D11).
- **Fee:** 5% Apixis Bank on in-family sales (D12).

## Family decisions still waiting on Awad

| Item | Why it is blocked | Who |
|---|---|---|
| AI credits (Anthropic) | Rawixis and Recovra provider checks return HTTP 400 "insufficient credits". Cixy is down on those sites until topped up or explicitly left off for the first tester round. | Awad |
| Ominix / Wattixis / Halaxis Wallet keys | `npm run family-keys` now includes all three. Run it, paste the SQL into the Wallet Supabase, paste each key into that site's Vercel. Keys are printed once, never stored. | Awad (or Claude via Supabase MCP on request) |
| `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` + `require_sso=true` | Flip per site once that site's own `apx_` key is in Vercel and its Apixis sign-in is verified live. | Claude after Awad confirms keys are in |
| Terms / Privacy pages | Drafted text needs counsel/Awad review before publishing. | Awad |

## Per-repo status (backend)

Legend: **Sell** = can take Ixis for something today. All branches for the 2026-09-30 pass: `claude/awesome-newton-3tygzi`.

| Repo | Backend state | Sell | Open items |
|---|---|---|---|
| ApixisWallet | Ledger, SSO, Stripe, SDK, cron, audit, rate limiting. 88+ tests. Migrations 007–010 live. | Yes | Legacy key still accepted; `require_sso=false` on all clients; Terms/Privacy. |
| Renoxis | Seats via Wallet, PKCE, `apixisSubOf`. | Yes | — |
| Socixis | Skins/packs/autopilot via Wallet, `apixisOwner`. Stripe webhook deactivated (D14). | Yes | Per-second render SKUs gated off (`PAID_RENDERS_LIVE`); launch/identity PRs #47/#48 unreviewed. |
| Contraxis | Pro redeem via Wallet. Stripe webhook deactivated (D14); local `credit_wallets` no longer fed. | Yes | PR #39 blocked only by a duplicate Vercel project (`temporary-turbo-sienna…`, wrong root). |
| Recovra | Reserve/capture-first paid plans (`activate_paid_plan_as_service`, receipts), Apixis ID routes, canonical SDK v3 (Codex PR #15). | After key | Production `SUPABASE_SERVICE_ROLE_KEY` validated but not configured; AI health degraded. |
| Deduxis | Redeem via Wallet; auth callback now `type: "email"`; owner = Apixis `sub` first. | Yes | — |
| Lyrixis | Track unlock via Wallet, OTP login. | Yes | Upload path needs `REDIS_URL`; worker needs `TRANSCRIPTION_API_KEY` (absent in Vercel). |
| Rawixis | Buyer seats via Wallet, `type: "email"`, admin key isolated. | Yes (seats) | Anthropic credits; full deal/fulfillment/settlement not end-to-end verified. |
| qahwahworld | Roaster seat via Wallet, PKCE. Physical-coffee Stripe is the approved exception. | Yes (seat) | Seller seat / featured listing SKUs exist in catalog but the site does not redeem them yet. |
| Halaxis | PKCE, world-agent wiring. Payments intentionally off. | No SKUs | Do not enable trading/investment features. |
| Launchixis | Redeem route answers 409 "not on sale" by design. | Off | — |
| PersonalContentBot | Clip redeem via Wallet; session email for ownership, Apixis `sub` for billing (Codex PR #9). | Yes | Durable/idempotent rendering beyond one 300 s request. |
| Apixis.dev | Hub, world kit, provision endpoint, pulse cron. Redeem owner = Apixis `sub` first; missing idempotency key is now rejected. | Hub | PRs #58/#59 (world) — #59 is DO NOT MERGE; starter = 1,000. |
| Geoxis | JS port of SDK; `PLANS_ON_SALE=false`. Redeem owner = Apixis `sub` first. | Off | — |
| NurseryToons | JS redeem; idempotency key now includes the user; world-agent update uses the service role. Family plan paused. | Off | — |
| Ominix | **Ixis-only (D13).** Orders reserve/capture through the Wallet with a 5% Apixis Bank fee; NXC ledger deactivated. | After key | Register as Wallet client; verify one order end to end. |
| Wattixis | Draft persistence async repair in progress (Codex, uncommitted on their machine). Not a Wallet client yet. | No | Register as Wallet client; `/api/drafts` validation. |
| awad-command | Internal: crypto-floor tick cron, mission control. Dead SDK v2 copy removed. | n/a | — |
| AwadBot | `AWADBOT_ON_SALE=false`; fulfilment TODO. Never run trading commands from an AI. | Off | — |
| github-actions | Shared `node-ci.yml`, Node 22. | n/a | — |
| afccommand / thenightexchange | Empty / trading-pit sim without Wallet. | n/a | — |

## Tester matrix (fill in as paths are actually exercised)

| Site | Path | Prereq | Verified live | Notes |
|---|---|---|---|---|
| Wallet | Buy Spark pack with Stripe test card → balance +1,000 | Apixis ID account | not yet this pass | `docs/LAUNCH_KEYS.md` step 2 |
| Renoxis | Apixis sign-in → buy seat → 409 on retry keeps access | Wallet balance | not yet | |
| Socixis | Apixis sign-in → skin unlock | Wallet balance | not yet | |
| Contraxis | Apixis sign-in → pro seat | Wallet balance | not yet | |
| Recovra | Apixis sign-in → paid plan activation receipt | service key in Vercel | not yet | |
| Ominix | Apixis sign-in → order complete → seller credited, 5% fee | Wallet key in Vercel | not yet | |

## Change log pointers

Every repo: `AI_CHANGELOG.md`. Family-wide audit that produced this board: Claude, 2026-09-30 (session
`claude/awesome-newton-3tygzi`). Codex tester-readiness handoff (2026-09-30, ~01:27 CT): nine shared-login PRs
merged, Recovra #15 and PersonalContentBot #9 merged, Recovra migration `tester_plan_activation` applied.
