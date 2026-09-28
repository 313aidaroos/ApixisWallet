Grok Bot (Developer Bot hub + product leads) notes. Every change Grok Bot makes to this product (code, env, database, deploys) gets a dated entry here so Claude, Hermes and Codex stay on the same page.

## 2026-09-27 (CT) — Developer Bot (hub)
- Wallet database: added 12 client rows in Supabase project `kzneeksminozmhnqaaun`, all with `require_sso=false`.
- Vercel: added `CHECKOUT_RETURN_HOSTS=spatial-dashboard-xi.vercel.app` and redeployed; no secret value is recorded here.
- Code note: `lib/checkout/return-url.ts` still lists `socixis.vercel.app` and `geoxis.vercel.app`; this was not fixed.
- Unapplied script patch: `/workspace/hubops/create-family-keys.fix.patch` updates family-site domain handling, adds Halaxis, uses Geoxis `spatial-dashboard-xi.vercel.app` plus extra callback paths, and supports `--only` for already-registered names; it remains unapplied and was not committed.
- Vercel name-only check: `WALLET_STATS_KEY` is missing on `apixis-wallet`.
- Undo: remove the added return-host setting and deactivate the 12 client rows; leave the code and patch unchanged.
