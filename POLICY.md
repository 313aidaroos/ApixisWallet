# Commerce policy — coins only

Apixis sells **one thing for dollars: Xis Points (coins)**.

Every product, plan, usage minute, theme, and upgrade is a **redeem**.
No Apixis app may open its own Stripe Checkout, Apple IAP, or “Buy now” for a subscription.

## Allowed

- Wallet `/` coin packs → Stripe Checkout
- App screens that say **Redeem · 15,000 XP** and call Wallet APIs
- Owner bonuses written through the ledger

## Forbidden

- Renoxis / Socixis / Recovra / Command selling their own plans
- Multiple checkout buttons on one marketing page
- Marketing XP as crypto, cash, or an investment
- XP → APX conversion

## App integration

1. Show price in XP and $ equivalent (`100 XP = $1`)
2. `POST /api/v1/quotes`
3. User confirms
4. `POST /api/v1/reservations`
5. Do the work
6. Capture or release

If an app still has Stripe price IDs for Growth/Business plans, remove them. Point the button at Wallet redeem.
