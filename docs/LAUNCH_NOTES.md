# Apixis Wallet: launch notes

_Updated 2026-09-25. One notes file per repo: what was changed, file by file, and everything you need to connect. The full family report: https://claude.ai/artifact/QERxA6PMsFK1vdR51Ex2NQ_

## Status

Live bank for the whole family. Ready: set keys and run `npm run family-keys` once.

## Connect (in order)

1. Supabase (Wallet project): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Stripe (the only place cards are charged): `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IXIS_*_PRICE_ID`. Webhook URL: `https://apixis-wallet.vercel.app/api/stripe/webhook`.
3. `WALLET_STATS_KEY`: same random value as on COMMAND (read-only graph).
4. Then run `npm run family-keys` and hand each site its block (see each repo's LAUNCH_NOTES).

Every key this repo reads is listed in `.env.example` (required, optional, and legacy names to leave unset).

## Apixis Wallet

This IS the Wallet. `lib/catalog.ts` lists every product a site can sell; `scripts/create-family-keys.ts` lists every site that gets a key. A site product that is not in the catalog is refused (404).

## Database

No pending changes.

## Open items

- AwadBot is not in `create-family-keys.ts` or the catalog on purpose: AwadBot does not deliver anything yet (see AwadBot notes). Add both when it does.

## What changed, file by file

Each changed backend code file also starts with a one-line `Change note (Claude, Sep 2026)` comment saying the same thing.

| File | Change |
|---|---|
| `.env.example` | Added `WALLET_STATS_KEY`; today added every key the code reads that was missing. |
| `AGENTS.md` | Documented the summary endpoint. |
| `README.md` | Documented the summary endpoint. |
| `app/api/v1/admin/summary/route.ts` | New. `GET /api/v1/admin/summary`, guarded by `WALLET_STATS_KEY`. Cannot move money. |
| `docs/LAUNCH_NOTES.md` | This file. |
| `lib/admin-summary.ts` | New. Read-only totals (sales, daily cash, per-app) for COMMAND's graph. |
| `lib/catalog.ts` | Added `socixis.avatar.pack.all` ($50, all skins). Socixis already honored it; the Wallet never listed it. |
| `test/admin-summary.test.ts` | New. Tests for the summary math and the key check. |

**Removed:** `Apixis_Wallet_MVP_GitHub_Ready.zip`: stale copy of the app already on main.

_Changes are backend and plumbing only. Pages, design and UI are not changed except where noted as a build or lint fix with no visual change._
