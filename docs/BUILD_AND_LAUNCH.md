# Build and Launch Directions

> **Superseded in part — read [AGENTS.md](../AGENTS.md) first.** It is the current source of truth for ownership, APIs, the ledger and the launch checklist.

## 1. Create services

Create separate development and production projects. Use Supabase for authentication/Postgres and Stripe Checkout for point-pack purchases. Deploy the Next.js app on Vercel. Never commit secrets.

## 2. Configure Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_apixis_wallet.sql` in a development database.
3. Confirm RLS is enabled and run database/security advisors.
4. Set the site URL and exact redirect allow-list for local, preview and production URLs.
5. Configure passwordless email or OAuth.
6. Replace demo identity with server-validated auth claims.
7. Add a private server function for balanced credit/spend transactions. Revoke public execution and check the caller.
8. Never authorize from user-editable metadata. Use database roles or app metadata.

## 3. Configure Stripe

1. Create one Stripe Product and Price for each XP pack.
2. Add the Price IDs to environment variables.
3. Use a restricted API key with only required Checkout permissions.
4. Create a webhook endpoint at `/api/webhooks/stripe`.
5. Subscribe to `checkout.session.completed`, refund and dispute events.
6. Verify every signature before processing.
7. On completion, write one balanced ledger transaction using the event ID as `external_id`; duplicate events must do nothing.
8. Add refund handling that reverses unspent eligible XP and records the decision.
9. Decide tax registrations with a professional before enabling Stripe Tax; enabling it without registrations does not collect tax.

## 4. Replace MVP placeholders

- Replace `client_reference_id` with the authenticated Supabase user ID.
- Replace in-memory demo balance and transactions with server queries.
- Implement atomic `credit_xp`, `reserve_xp`, `capture_xp`, `release_xp` and `refund_xp` database operations.
- Spend bonus XP first only when its restrictions allow it; otherwise use paid XP.
- Add organization wallets, allocations and approval thresholds.
- Add a product catalog table rather than hard-coding prices.
- Add subscription renewal jobs with retry and low-balance notices.
- Add owner administration, audit logs, rate limits and fraud monitoring.

## 5. Connect Renoxis

Renoxis never stores its own authoritative XP balance. It calls Apixis Wallet to:

1. Request a quote for a Renoxis product/action.
2. Display the XP and dollar-equivalent price.
3. Ask for user approval when policy requires it.
4. Reserve XP with a unique idempotency key.
5. Perform the action.
6. Capture the reservation on success or release it on failure.
7. Read the resulting entitlement and receipt.

Launch SKUs are `renoxis.activate` at 5,000 Ixis ($50, one-time) and `renoxis.agent.monthly` at 5,000 Ixis ($50/mo). There is no 30,000 Ixis Renoxis seat. See [docs/RENOXIS.md](RENOXIS.md).

## 6. Deployment checklist

- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- No secret exists in git history, client code, logs or analytics.
- Preview and production databases/keys are separate.
- Webhook retry and duplicate-event tests pass.
- Concurrent-spend test cannot create a negative balance.
- RLS tests prove users cannot read other wallets.
- Refund, dispute, failed checkout and expired session flows are tested.
- Terms clearly state XP limitations and refund policy.
- Payments counsel reviews stored-value structure before public launch.
- Privacy policy, terms, support channel and status monitoring are live.
