# Apixis Orbit — ApixisWallet integration handoff

**Status: NOT CONNECTED**. This PR is a safe scoped implementation brief and capability manifest, with no production API or user behavior changed.

## What exists today
`AGENTS.md` is the authority for single Apixis ID, Wallet balance, ledger holds/capture/release, pricing and SDK copy-not-fork. Apixis.dev must never create another wallet, cash ledger or Stripe checkout.

## Proposed scope
- Capability: `wallet.ixis.balance.read` (`read`, planned).
Expose the existing authenticated customer's balance and applicable Orbit entitlements through the existing Wallet SDK. Do not create a new route or SKU until a reviewed, scoped need exists.

## Concrete work to implement next
1. Reuse current Wallet SDK and identity subject; do not duplicate/fork client or ledger.
2. Scope any server-to-server balance read to the actual signed-in account; never accept arbitrary email.
3. Do not add or price Orbit usage without owner approval and a Wallet catalog product.
4. If paid usage is later approved, follow existing quote/reserve/capture/release and audit procedures; no client-supplied amounts.
5. Test unauthorized owner, insufficient balance, duplicate retries and captured-vs-released holds before enabling any paid tool.

## Universal Orbit gates
1. The Orbit host uses the **existing Apixis identity** and wallet; this repo does not create another credit ledger, agent registry, checkout or auth provider.
2. Any future adapter needs a dedicated signed service credential, expiry + replay prevention, binding from Apixis ID subject to the **local account or tenant**, and per-resource authorization. The Orbit hub must not impersonate users by supplying emails.
3. Data must be genuine and have a source timestamp and `demo` flag; errors and absent integrations fail closed. User-facing text must distinguish draft, submitted, paid, and verified states.
4. Only read/draft initially. No autonomous outbound messaging, spending, contracts, orders, investments, publishing or settlement.
5. Require unit/integration tests for wrong owner, missing creds, no-data response, retried requests and source freshness.
6. Never activate an Orbit capability in Core until product-specific code, tests and owner production configuration are verified.

**This PR provides integration preparation only, not runtime wiring.** See https://github.com/313aidaroos/Apixis.dev/pull/86 for the draft Orbit Core.
