# Wallet embed

Every Apixis-family product site uses this contract. Production host: `https://apixis-wallet.vercel.app` (custom domain deferred).

Ixis is bought on Wallet and spent by redeeming from Wallet. 100 Ixis = $1.

## Do not

- Open a second Stripe Checkout on the product site for plans, packs, files, or Ixis.
- Invent a per-product cash ledger, a "Socixis balance", or any paid bucket outside Apixis Wallet.
- Credit Ixis in the browser, in your database, or when the user lands back on your site.
- Offer cash-out, withdraw, or a convert-to-dollars button.

Credit stays on Wallet. The Stripe webhook calls `credit_xp` with `p_external_id` = the Stripe event id and `p_bucket` = `paid`. Your site never writes that credit.

After the credit, the destination is one of two things:

- **Keep in Apixis Wallet**, then redeem a SKU from the catalog.
- **Return to the sister site** when the deep link included an allowlisted `return_url`, so the customer can redeem where they came from.

There is no transfer into a second balance.

## Deep link

Send the customer to Wallet already naming the origin product and, when you have one, a return URL.

```
https://apixis-wallet.vercel.app/buy?product=socixis&return_url=https%3A%2F%2Fsocixis.vercel.app%2Fredeem
```

| Query | Required | Meaning |
| --- | --- | --- |
| `product` (alias `app`) | no | Origin product: `socixis`, `renoxis`, `recovra`, `deduxis`, `contraxis`, `contentbot`, `apixis`, `family`, `cixy`, or `wallet`. |
| `return_url` | no | Absolute `https` URL on an allowlisted host. Wallet opens it only after the webhook credit. |

`return_url` must be URL-encoded. Allowed hosts are `apixis.dev` (and subdomains) and the exact production hosts in `lib/checkout/return-url.ts` (`socixis.vercel.app`, `renoxis.vercel.app`, and the other family `project.vercel.app` names). A lookalike such as `socixis-git-main.vercel.app` is rejected. Preview hosts go in `CHECKOUT_RETURN_HOSTS` as exact hostnames, not wildcards.

The customer must be signed in on Wallet with the same Apixis account. Checkout without that session returns `401` `Sign in required`.

Stripe then returns the browser to:

```
https://apixis-wallet.vercel.app/buy/complete?session_id={CHECKOUT_SESSION_ID}
```

`/buy/complete` polls until the paid ledger row exists. It does not add Ixis itself.

- Allowlisted `return_url`: Wallet sends them back to that URL.
- No allowlisted `return_url`: they confirm **Apixis Wallet** or a sister app. Confirming an app links to Redeem for that app's SKUs. The Ixis remains in the Wallet paid balance.

Same fields are accepted on `POST /api/checkout` as JSON (`return_url`, `product`) or query parameters, next to `packId` (`spark`, `agent`, `office`, `business`). Detail: [docs/INTEGRATION.md](INTEGRATION.md).

## Optional balance

Show a balance only from Wallet. Skip the call if you only need a buy button. This route authenticates the **Wallet** user (Wallet session cookie or Wallet-issued access token); a sister site's own Supabase token is not accepted, so most sister sites should link to Wallet instead of showing a number.

**GET** `https://apixis-wallet.vercel.app/api/v1/wallet`

```bash
curl https://apixis-wallet.vercel.app/api/v1/wallet \
  -H "Authorization: Bearer <USER_SESSION_TOKEN>"
```

Contract when the signed-in ledger read is connected:

```json
{
  "currency": "Ixis",
  "available": 52000,
  "paid": 50000,
  "bonus": 2000,
  "reserved": 0,
  "rate": { "ixisPerDollar": 100, "xpPerDollar": 100 }
}
```

`rate.ixisPerDollar` (alias `xpPerDollar`) is `100` (100 Ixis = $1). Show Ixis first and the dollar equivalent beside it: `52,000 Ixis ($520)`.

The route is live: it returns real numbers from the ledger. `401` means the viewer is not signed in to Wallet.

## CTA copy

Buy (leaves your site for Wallet):

```
Buy Ixis
```

```
Need more Ixis? Buy a pack in Apixis Wallet.
```

```
Spark · 1,000 Ixis ($10)
```

```
Buy 10,000 Ixis ($100) in Apixis Wallet
```

Redeem (stays on your site, spends the Wallet balance through the Wallet APIs):

```
Redeem · 45,000 Ixis ($450)
```

```
Social Autopilot · 45,000 Ixis ($450)
```

Use the catalog price. Do not round in a way that changes the peg.

Example link for the buy CTA:

```html
<a href="https://apixis-wallet.vercel.app/buy?product=socixis&return_url=https%3A%2F%2Fsocixis.vercel.app%2Fredeem">
  Buy Ixis
</a>
```

After they return, redeem with quote → reserve → provision → capture, or release if provision fails. That spend is the Wallet ledger, not a second Stripe charge. See [docs/INTEGRATION.md](INTEGRATION.md).
