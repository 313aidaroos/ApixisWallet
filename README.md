# Apixis Wallet

**One balance across every Apixis product.**

> **Bots and developers: read [AGENTS.md](AGENTS.md) first.** It is the source of truth for ownership (design vs backend), money rules, APIs, migrations and the launch checklist.

Detailed vision, including the Phase 5 legal-gated own-chain / own-currency path: [docs/WALLET_VISION_DETAILED.md](docs/WALLET_VISION_DETAILED.md).

Apixis Wallet is the shared commerce layer for Renoxis, Socixis, Lyrixis, Recovra, Deduxis, Rawixis, Halaxis, Apixis Command and future Apixis products. Customers buy Xis Points (XP), keep one universal balance, and spend it on subscriptions, usage, upgrades and personalization.

Source unpacked from `Apixis_Wallet_MVP_GitHub_Ready.zip` onto `main` on 2026-09-19.

## What works

- Stripe Checkout for Ixis packs, signed webhook, idempotent credit; full refunds and lost disputes reverse the pack.
- Double-entry, append-only Supabase ledger (migrations 001–007): reserve → capture/release with row locking, expiring holds, entitlements with 30-day periods.
- Sister-site APIs with per-site scoped API keys, SDK v2 (`sdk/apixis-wallet.ts`).
- Real balance / history / in-Wallet redeem endpoints (`lib/wallet-client.ts` for the UI).
- Append-only legal record of every money event (`audit_events`, migration 008) with a master-only CSV export.
- CI: lint, typecheck, unit tests, build, ledger SQL tests incl. concurrency.

The dashboard UI (`components/WalletScreen.tsx`) still shows **demo data** until it is wired to `lib/wallet-client.ts` — see AGENTS.md §6.

## Sister sites

Buy Ixis on Wallet. Redeem it from Wallet. Do not add a second Stripe Checkout or a per-product cash ledger.

The embed contract (deep link, optional balance, CTA copy) is [docs/WALLET_EMBED.md](docs/WALLET_EMBED.md). API detail is [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Tree placement

This is one apple on the Apixis trunk:

- Own repo: `313aidaroos/ApixisWallet`
- Own Vercel project (to create)
- Supabase tables live in `public` (a `wallet` schema move is deferred; see AGENTS.md §9)
- Shared Apixis ID / owner email with Command and the other apps
- Ixis is closed-loop platform credit, not crypto. No chain, no convert button (see POLICY.md).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run check      # lint + typecheck + unit tests + build
npm run test:sql   # ledger SQL tests on a local Postgres (never production)
```

## Non-negotiable rules

1. Never modify wallet balance directly. Add balanced ledger entries.
2. Use Stripe webhook event IDs as idempotency keys.
3. Keep service and Stripe restricted keys server-only.
4. Ixis is non-transferable, non-withdrawable platform credit at launch.
5. A future chain token is a separate legal product, never an automatic conversion.
6. Show `100 Ixis = $1` alongside prices.
7. Paid Ixis does not expire; promotional Ixis may expire only with disclosure (expiry is not implemented yet — don't issue expiring bonus).
8. Every charge must be shown before approval and recorded in the ledger.

Read `AGENTS.md`, then `VISION.md` and `POLICY.md`, before continuing development.
