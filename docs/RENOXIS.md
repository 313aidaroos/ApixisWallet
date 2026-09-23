# Renoxis — Wallet launch SKUs

Renoxis does not charge a card. Customers buy Ixis in Apixis Wallet, then Renoxis redeems from that Wallet balance. There is no Renoxis Stripe and no second balance.

Prices are authoritative in `lib/catalog.ts`. Never trust a price sent by the browser.

| Canonical key | Aliases | Ixis | USD |
| --- | --- | --- | --- |
| `renoxis.activate` | `renoxis-activate` | 5,000 | $50 one-time |
| `renoxis.agent.monthly` | `renoxis.monthly`, `renoxis-monthly` | 5,000 | $50/mo |

`renoxis.agent.monthly` is the only month seat. It used to be 30,000 Ixis ($300). That price is retired. Do not add a second monthly key.

File templates (`renoxis.file.listing`, `renoxis.file.offer`) stay 1,000 Ixis. Heavy Cixy metering is elsewhere.

## Buy Ixis

Send the signed-in customer here. Encode `return_url`. The host must be allowlisted (`renoxis.vercel.app`, `apixis.dev` and its subdomains, or `CHECKOUT_RETURN_HOSTS`).

```
https://apixis-wallet.vercel.app/buy?product=renoxis&return_url=<encoded>
```

`product=renoxis` is the Renoxis destination. Paid Ixis lands in the Wallet paid balance. Redeem for that destination lists **Renoxis Activate** and **Renoxis Monthly** (plus the $10 file SKUs). Same list after cash-buy return when the customer confirms Renoxis: `productsForDestination("renoxis")`.

## Redeem

Quote, then reserve, then provision on Renoxis, then capture. Release if provision fails. Same routes as [INTEGRATION.md](INTEGRATION.md).

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{"productKey":"renoxis.activate"}'
```

A quote for either SKU (or its alias) returns `xp: 5000` and `usdEquivalent: 50`. `productKey` in the response is the canonical key.

### Idempotency keys

Pass `idempotencyKey` on `POST /api/v1/reservations`. Retries with the same key must not double-spend. Keys must be 8–80 characters. A UUID user id fits.

| Redeem | `idempotencyKey` |
| --- | --- |
| Activate | `renoxis-{userId}-activate` |
| Month seat | `renoxis-{userId}-seat-{YYYY-MM}` |

Example seat key: `renoxis-11111111-1111-4111-8111-111111111111-seat-2026-09`.

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WALLET_API_KEY>" \
  -d '{
    "productKey": "renoxis.agent.monthly",
    "idempotencyKey": "renoxis-USER_ID-seat-2026-09",
    "owner_email": "customer@example.com"
  }'
```

Then provision the seat in Renoxis. On success:

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations/RESERVATION_ID/capture \
  -H "Authorization: Bearer <WALLET_API_KEY>"
```

On failure, `POST /api/v1/reservations/RESERVATION_ID/release`.

Reserve, capture and release are live on the ledger. Use SDK v2 `redeem()` (`sdk/apixis-wallet.ts`); it handles retries and never removes access from a charged customer. A release answered with `409 already_captured` means the customer was charged — keep the seat.

## Entitlements

`GET /api/v1/entitlements?app=renoxis&owner_email=<verified email>` with the Renoxis API key returns the customer's active Renoxis rows. Capture writes them:

- `renoxis.activate` — `status: active`, `renews_at: null` (one-time, never expires)
- `renoxis.agent.monthly` — `status: active`, `renews_at` = capture + 30 days. Redeeming the next month while active stacks another 30 days. After `renews_at` the row is no longer returned.

`productKey` is always the canonical key, even if the quote used an alias. Renoxis may keep `seat_period_end` too; the Wallet row is authoritative for "paid right now". Full backend overview: [AGENTS.md](../AGENTS.md).
