# One checkout

Customers buy coins in Apixis Wallet.
They redeem coins inside each product.

That is the whole store.

Sister apps send people to `/buy?return_url=...&product=socixis`. After Stripe, the webhook credits the Wallet paid balance. Wallet then either returns them to an allowlisted URL or lets them keep the Ixis here and open Redeem. There is no cash-out and no second balance. See `docs/WALLET_EMBED.md` and `docs/INTEGRATION.md`.
