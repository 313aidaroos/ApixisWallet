# Apixis Wallet MVP

**One balance across every Apixis product.**

Detailed vision, including the Phase 5 legal-gated own-chain / own-currency path: [docs/WALLET_VISION_DETAILED.md](docs/WALLET_VISION_DETAILED.md).

Apixis Wallet is the shared commerce layer for Renoxis, Socixis, Lyrixis, Recovra, Deduxis, Rawixis, Halaxis, Apixis Command and future Apixis products. Customers buy Xis Points (XP), keep one universal balance, and spend it on subscriptions, usage, upgrades and personalization.

Source unpacked from `Apixis_Wallet_MVP_GitHub_Ready.zip` onto `main` on 2026-09-19.

## What works in this MVP

- Responsive wallet dashboard and point-pack storefront.
- Cross-platform product catalog and preview activation.
- Purchased, bonus and reserved XP presentation.
- Transaction history and renewal insight.
- Stripe Checkout route with signed-webhook skeleton.
- Supabase double-entry ledger schema, RLS and entitlements.
- Clear separation between closed-loop XP and future APX token.

The dashboard runs with **demo data** immediately. Real authentication, persisted balances and actual XP fulfillment require completing `docs/BUILD_AND_LAUNCH.md`.

## Sister sites

Buy Ixis on Wallet. Redeem it from Wallet. Do not add a second Stripe Checkout or a per-product cash ledger.

The embed contract (deep link, optional balance, CTA copy) is [docs/WALLET_EMBED.md](docs/WALLET_EMBED.md). API detail is [docs/INTEGRATION.md](docs/INTEGRATION.md).

Cixy cosmetics (outfits, themes, work templates, office settings) are shared Cixy assets sold only from this Wallet. Prices stay Coming soon until Awad locks Ixis integers. See [docs/CIXY_COSMETICS.md](docs/CIXY_COSMETICS.md).

## Tree placement

This is one apple on the Apixis trunk:

- Own repo: `313aidaroos/ApixisWallet`
- Own Vercel project (to create)
- Shared Supabase project with schema `wallet` (migration currently uses `public`; move before production)
- Shared Apixis ID / owner email with Command and the other apps
- XP is platform credit, not crypto. APX stays disabled.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run lint
npm run typecheck
npm run build
```

## Non-negotiable rules

1. Never modify wallet balance directly. Add balanced ledger entries.
2. Use Stripe webhook event IDs as idempotency keys.
3. Keep service and Stripe restricted keys server-only.
4. XP is non-transferable, non-withdrawable platform credit at launch.
5. APX is a separate future digital asset and never an automatic XP conversion.
6. Show `100 XP = $1` alongside prices.
7. Paid XP does not expire; promotional XP may expire only with disclosure.
8. Every charge must be shown before approval and recorded in the ledger.

Read `VISION.md`, `docs/BUILD_AND_LAUNCH.md`, and `GROK_MASTER_PROMPT.md` before continuing development.
