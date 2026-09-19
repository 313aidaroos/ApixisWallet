# Master Prompt for Grok / Cursor / Developer Bot

You are the lead engineer and product architect for **Apixis Wallet**. Read every repository file before changing code. Preserve the existing visual direction: premium, futuristic, restrained black/graphite interface with acid-lime XP accents and blue reserved for future APX. The application must remain responsive and accessible.

## Mission

Turn this MVP into the secure shared commerce layer for every Apixis company. Renoxis is the first integration. Users have one Apixis ID, one XP wallet, one transaction ledger and product entitlements across all apps. Cixy helps explain balances, upcoming charges and cross-platform actions.

## Required build order

1. Establish Supabase SSR auth with secure session refresh and protected dashboard routes.
2. Apply and test the wallet migration in development.
3. Replace demo dashboard values with authenticated server data.
4. Implement private atomic ledger operations. All wallet mutations must be balanced, transactional and idempotent. Never `UPDATE balance = ...`.
5. Complete Stripe Checkout and signed webhook fulfillment.
6. Add product catalog, quotes, reservations, captures, releases, refunds and entitlements.
7. Add subscriptions paid from XP, upcoming charge approvals and low-balance notifications.
8. Build owner admin: XP sold, outstanding liability, spend/revenue by app, refunds, bonuses, costs and suspicious activity.
9. Publish a typed SDK and connect Renoxis without duplicating wallet data.
10. Add tests, monitoring, documentation and deployment automation.

## Required APIs

- `GET /api/v1/wallet` — balances by paid, bonus and reserved buckets.
- `GET /api/v1/ledger` — paginated user receipts.
- `POST /api/v1/quotes` — immutable short-lived price quote.
- `POST /api/v1/reservations` — hold XP atomically.
- `POST /api/v1/reservations/:id/capture` — finalize successful action.
- `POST /api/v1/reservations/:id/release` — return XP after failure.
- `GET /api/v1/entitlements` — active access and allowances.
- `POST /api/v1/checkout` — point-pack Checkout Session.
- `POST /api/webhooks/stripe` — verified idempotent fulfillment.

Every mutation requires authentication, authorization, schema validation, an idempotency key and an audit event. Use integer XP only. Never trust prices or user IDs supplied by the browser.

## Security gates

- Supabase secret/service credentials and Stripe keys are server-only.
- RLS exists on every exposed table with ownership predicates.
- Authorization never uses user-editable metadata.
- Security-definer functions are private, have an explicit search path, revoke PUBLIC execution and validate caller identity.
- Stripe signatures are verified against the raw body.
- Apply rate limiting to purchases and mutations.
- Prevent negative balances under concurrent transactions.
- Logs contain IDs and outcomes, never secrets or sensitive payment data.
- Add unit, integration, RLS, idempotency, concurrency and end-to-end tests.

## Legal/product constraints

XP is a closed-loop platform credit, not crypto, cash, stored profit, yield or an investment. It is initially non-transferable and non-withdrawable. Paid XP does not expire. Promotional XP is separate and restrictions are disclosed. APX is a future, separately reviewed blockchain asset. Do not implement XP-to-APX conversion, staking, public trading or investment language.

## Definition of done

- A new user can authenticate, buy an XP pack in Stripe test mode, receive XP exactly once through the webhook, see a receipt and spend XP on a Renoxis entitlement.
- Duplicate webhooks cannot double-credit.
- Two simultaneous spends cannot overdraw.
- A user cannot access another user or organization’s wallet.
- Failed actions release reservations.
- Owner analytics reconcile with the ledger.
- Lint, typecheck, build and the complete test suite pass.
- README and environment/deployment instructions match the implemented system.

Do not claim any integration is complete until you run and report its tests. Do not expose secrets, invent credentials, bypass RLS, or silently weaken the ledger design to make a demo pass.
