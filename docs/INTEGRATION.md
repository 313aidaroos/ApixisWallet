# Sister-Site Integration — Apixis Wallet APIs

**Apixis Wallet is the one checkout for the whole Apixis family.** Customers buy Ixis here and redeem it inside your product.

Base URL (production): `https://apixis-wallet.vercel.app`  
Auth: Bearer token with Apixis ID (service-role key for server-to-server).

Sister-site embed (deep link, balance, CTA copy): [docs/WALLET_EMBED.md](WALLET_EMBED.md).

## Flow

1. **Quote** — GET the Ixis price for your SKU.
2. **Show** — Display "Redeem · 15,000 Ixis ($150)" to the user.
3. **Reserve** — Hold the Ixis when the user clicks Redeem (idempotent).
4. **Provision** — Perform your action (create subscription, unlock feature, etc.).
5. **Capture** — Finalize the spend if provision succeeded.
6. **Release** — Return the Ixis if provision failed or timed out.

Never run your own Stripe Checkout for plans. Ixis-only redemptions keep the family commerce clean.

---

## Cash buy and return

Sister apps do not charge a card for plans. Send the signed-in customer to Wallet to buy an Ixis pack. Production host: `https://apixis-wallet.vercel.app` (custom domain later).

```
https://apixis-wallet.vercel.app/buy?return_url=https%3A%2F%2Fsocixis.vercel.app%2Fbilling&product=socixis
```

`POST /api/checkout` accepts the same fields in the JSON body or as query parameters, next to `packId` (`spark`, `agent`, `office`, `business`).

| Param | Required | Meaning |
| --- | --- | --- |
| `return_url` | no | Absolute URL opened after the pack is credited. The host must be allowlisted. |
| `product`, `app`, or `destination` | no | Sister app slug: `socixis`, `renoxis`, `apixis`, `rawixis`, `contraxis`, `halaxis`, `lyrixis`, `qahwahworld`, `recovra`, `launchixis`, `awadbot`, `cixy`, `deduxis`, `contentbot`, `family`, or `wallet`. |

Allowlist (`lib/checkout/return-url.ts`):

- `apixis.dev` and any subdomain (`https` only)
- Exact production hosts such as `apixis-wallet.vercel.app` and `socixis.vercel.app`. A lookalike like `socixis-git-main.vercel.app` is rejected, because prefix matching would trust another Vercel project.
- Extra exact hostnames in `CHECKOUT_RETURN_HOSTS` (comma-separated, no wildcards). Put preview URLs here.

Anything else is a 400 `return_url is not an allowlisted Apixis host`. An unknown `product` is a 400. Checkout stores the canonical `return_url` and `destination_app` on the Stripe Checkout Session metadata (and on the PaymentIntent metadata). `client_reference_id` stays the Supabase user id. `success_url` is `/buy/complete?session_id={CHECKOUT_SESSION_ID}`. The embed contract for that handoff is [docs/WALLET_EMBED.md](WALLET_EMBED.md).

The success page polls `GET /api/checkout/status?session_id=cs_...` until a paid ledger row exists. Credit still happens only in the Stripe webhook via `credit_xp` with `p_external_id` = `event.id` and `p_bucket` = `paid`. The browser cannot invent a balance.

- When the session has an allowlisted `return_url`, Wallet redirects there after the credit (`GET /api/checkout/return`). That route ignores any `return_url` query param.
- Otherwise the customer chooses Apixis Wallet or a sister app and confirms. There is no transfer into a product balance. The Ixis stays in the Wallet paid balance. The page links to Redeem for that app's catalog SKUs.

100 Ixis = $1. This flow does not cash out.

```bash
curl -X POST https://apixis-wallet.vercel.app/api/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: <supabase-auth-cookie>" \
  -d '{"packId":"spark","return_url":"https://socixis.vercel.app/billing","product":"socixis"}'
```

---

## 1. Quote a product

**POST** `/api/v1/quotes`

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{"productKey": "socixis.autopilot.monthly"}'
```

**Request:**
```json
{
  "productKey": "socixis.autopilot.monthly"
}
```

**Response (200):**
```json
{
  "quoteId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "productKey": "socixis.autopilot.monthly",
  "app": "Socixis",
  "name": "Social Autopilot",
  "xp": 45000,
  "usdEquivalent": 450,
  "expiresAt": "2026-09-20T12:45:00Z",
  "payable": "xp_only"
}
```

**Errors:**
- `400` — `Coming soon`. The SKU is in the catalog with `xp: null` or `status: "coming_soon"`, and it is not a wardrobe essential. The body has no `xp`. Do not invent a price. Premium Cixy cosmetics use this until Awad locks integers. See [docs/CIXY_COSMETICS.md](CIXY_COSMETICS.md).
- `400` — `Included`. The SKU is an always-owned wardrobe essential (`outfit.starter`, `theme.paper`, `office.desk`). The body has no `xp`. Do not reserve it.
- `404` — Unknown SKU (contact @apixiswallet to add it to the catalog).

---

## 2. Reserve Ixis

**POST** `/api/v1/reservations`

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WALLET_API_KEY>" \
  -d '{
    "productKey": "socixis.autopilot.monthly",
    "idempotencyKey": "socixis-sub-abc123-2026-09"
  }'
```

**Request:**
```json
{
  "productKey": "socixis.autopilot.monthly",
  "quoteId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "idempotencyKey": "socixis-sub-abc123-2026-09"
}
```

`idempotencyKey` must be unique per redemption attempt (e.g., `{yourApp}-{userId}-{subscriptionId}-{month}`). Retries with the same key return the same reservation.

**Response (201):**
```json
{
  "reservationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "held",
  "productKey": "socixis.autopilot.monthly",
  "xp": 45000
}
```

**Errors:**
- `400` — Missing or invalid request, `Coming soon` for an unpriced premium SKU, or `Included` for a wardrobe essential.
- `402` — Insufficient Ixis balance.
- `404` — Unknown product.

The Ixis is now **reserved** (deducted from available but not yet spent). You have 10 minutes to capture or release before auto-release.

---

## 3. Capture (finalize spend)

**POST** `/api/v1/reservations/{reservationId}/capture`

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/capture \
  -H "Authorization: Bearer <WALLET_API_KEY>"
```

**Response (200):**
```json
{
  "reservationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "captured",
  "receiptId": "tx_abc123"
}
```

Call this **after** you've successfully provisioned the service (created the subscription row, granted the entitlement, etc.). The spend is final.

**Errors:**
- `404` — Reservation not found or already captured/released.

---

## 4. Release (cancel reservation)

**POST** `/api/v1/reservations/{reservationId}/release`

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/release \
  -H "Authorization: Bearer <WALLET_API_KEY>"
```

**Response (200):**
```json
{
  "reservationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "released"
}
```

Call this if your provision step **failed** or if the user canceled before you provisioned. The Ixis returns to their available balance.

**Errors:**
- `404` — Reservation not found or already captured/released.

---

## 5. Check wallet balance

**GET** `/api/v1/wallet`

```bash
curl https://apixis-wallet.vercel.app/api/v1/wallet \
  -H "Authorization: Bearer <USER_SESSION_TOKEN>"
```

**Response (200):**
```json
{
  "currency": "Ixis",
  "available": 52000,
  "paid": 50000,
  "bonus": 2000,
  "reserved": 0,
  "rate": { "xpPerDollar": 100 }
}
```

Use this to show the user's balance before redemption or to check eligibility.

---

## 6. List entitlements

**GET** `/api/v1/entitlements?app=socixis`

```bash
curl "https://apixis-wallet.vercel.app/api/v1/entitlements?app=socixis" \
  -H "Authorization: Bearer <USER_SESSION_TOKEN>"
```

**Response (200):**
```json
{
  "entitlements": [
    {
      "id": "ent_xyz",
      "app": "socixis",
      "productKey": "socixis.autopilot.monthly",
      "status": "active",
      "renewsAt": "2026-10-20T00:00:00Z",
      "xpPrice": 45000
    }
  ]
}
```

Returns active subscriptions/entitlements for the signed-in user. Use this to check what they already own before showing a purchase screen.

### Cixy wardrobe

**GET** `/api/v1/entitlements?app=cixy`

Cosmetics ownership is this list, not a second API. Each wardrobe row uses the same entitlement fields plus `kind: "wardrobe"` and `unlockAssetId` from `cosmeticsCatalog`. `xpPrice` is `0` for an essential and, once a purchase is stored, the catalog integer recorded at grant. Reading the list does not spend Ixis. Equip and unequip do not either. They are not consume-on-apply.

The live route returns the always-owned essentials only (`outfit.starter`, `theme.paper`, `office.desk`). Purchased rows are not stored yet, so the response does not invent them. Flow and the response body: [docs/CIXY_COSMETICS.md](CIXY_COSMETICS.md).

A product customize UI treats `status: "active"` ids as selectable on the one shared Cixy. A premium `unlockAssetId` missing from the list stays locked, with a Buy on Wallet link.

---

## 7. Ledger (transaction history)

**GET** `/api/v1/ledger?limit=50&offset=0`

```bash
curl "https://apixis-wallet.vercel.app/api/v1/ledger?limit=50&offset=0" \
  -H "Authorization: Bearer <USER_SESSION_TOKEN>"
```

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "tx_abc123",
      "kind": "spend",
      "description": "Socixis Autopilot · September 2026",
      "app": "socixis",
      "amount": -45000,
      "createdAt": "2026-09-20T12:30:00Z"
    },
    {
      "id": "tx_def456",
      "kind": "purchase",
      "description": "Studio coins",
      "app": null,
      "amount": 50000,
      "createdAt": "2026-09-19T10:15:00Z"
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0
}
```

Optional: display this in your app's billing page so users see their full Ixis history across the family.

---

## Catalog

Current SKUs (as of 2026-09-20):

| Product Key                       | App         | Name                      | Ixis    | USD      |
|-----------------------------------|-------------|---------------------------|---------|----------|
| `apixis.activate`                 | Apixis.dev  | Citizen activation        | 2,000   | $20      |
| `apixis.citizen.monthly`          | Apixis.dev  | Citizen seat              | 2,000   | $20/mo   |
| `apixis.founder.monthly`          | Apixis.dev  | Founder seat              | 10,000  | $100/mo  |
| `renoxis.agent.monthly`           | Renoxis     | Agent Office              | 30,000  | $300/mo  |
| `socixis.autopilot.monthly`       | Socixis     | Social Autopilot          | 45,000  | $450/mo  |
| `recovra.intel.monthly`           | Recovra     | Recovery Intelligence     | 22,000  | $220/mo  |
| `deduxis.receipts.monthly`        | Deduxis     | Receipt Intelligence      | 15,000  | $150/mo  |
| `contraxis.seat.starter`          | Contraxis   | Pro Starter               | 9,900   | $99/mo   |
| `contraxis.seat.pro`              | Contraxis   | Pro Professional          | 39,900  | $399/mo  |
| `apixis.file.unit`                | Family      | File / template / skin    | 1,000   | $10      |
| `socixis.avatar.base`             | Socixis     | Avatar base               | 1,000   | $10      |
| `socixis.avatar.skin.*`           | Socixis     | Avatar skin (various)     | 1,000   | $10/each |
| `socixis.site.*`                  | Socixis     | Site pack (various)       | 1,000   | $10/each |
| `renoxis.file.*`                  | Renoxis     | Listing/offer file        | 1,000   | $10/each |

### Shop (`shopCatalog`)

Wallet **Shop** sells templates, legacy Cixy packs, merch, and the Cixy cosmetics shelf. Priced rows below live in `shopCatalog` in `lib/catalog.ts` (not in Stripe `pointPacks`). A shop purchase is a wallet → product Ixis spend: same quote → reserve → capture path as redeem. Cash packs stay on the Buy tab only. Cosmetics (`cosmeticsCatalog`, `cixy.cosmetic.*`) are shared Cixy assets with `xp: null` until Awad locks integers — see [docs/CIXY_COSMETICS.md](CIXY_COSMETICS.md). Quote and reserve answer `400` `Coming soon` for those keys. `shop.cixy.voice`, `shop.cixy.skin`, and `shop.cixy.persona` stay priced legacy packs. They are not aliases of the cosmetics rows.

Floor is 1,000 Ixis ($10), `UNIT_XP`. Merch keys are visual placeholders (`Design coming`). Physical fulfillment is stubbed until designs land — the Wallet shows "We'll fulfill when designs land."

| Product Key                    | Category  | Name                    | Ixis   | USD   |
|--------------------------------|-----------|-------------------------|--------|-------|
| `shop.template.file.unit`      | Templates | File / template unit    | 1,000  | $10   |
| `shop.template.site.saas`      | Templates | Site pack: SaaS         | 1,000  | $10   |
| `shop.template.site.shop`      | Templates | Site pack: Shop lite    | 1,000  | $10   |
| `shop.template.listing`        | Templates | Listing file            | 1,000  | $10   |
| `shop.template.offer`          | Templates | Offer file              | 1,000  | $10   |
| `shop.cixy.voice`              | Cixy      | Voice pack              | 1,000  | $10   |
| `shop.cixy.skin`               | Cixy      | Skin pack               | 2,500  | $25   |
| `shop.cixy.persona`            | Cixy      | Persona pack            | 5,000  | $50   |
| `shop.merch.tee`               | Merch     | Tee                     | 2,500  | $25   |
| `shop.merch.hoodie`            | Merch     | Hoodie                  | 5,000  | $50   |
| `shop.merch.sticker`           | Merch     | Sticker pack            | 1,000  | $10   |
| `shop.merch.mug`               | Merch     | Mug                     | 1,500  | $15   |

Quote any of these with `POST /api/v1/quotes` and `{ "productKey": "shop.template.file.unit" }`.

**Need a new SKU?** Message @apixiswallet with:
- Product key (e.g., `yourapp.plan.monthly`)
- Display name
- Ixis price (100 Ixis = $1)
- Description

The catalog lives in `lib/catalog.ts` in the Wallet repo. Only the Wallet lead approves additions.

---

## Auth

- **User-scoped calls** (wallet balance, entitlements, ledger): pass the user's Supabase session JWT as `Authorization: Bearer <token>`.
- **Server-scoped calls** (reserve, capture, release on behalf of a user): use a Wallet API key (Supabase service_role). Contact @hermes for provisioning.

Keep the service key server-only. Never send it to the browser.

---

## Error Codes

| Code | Meaning                                  |
|------|------------------------------------------|
| 400  | Invalid request (missing field, bad format) |
| 401  | Missing or invalid auth token            |
| 402  | Insufficient Ixis balance                |
| 404  | Resource not found (reservation, product)|
| 409  | Conflict (already captured/released)     |
| 503  | Service unavailable (Stripe/Supabase down) |

---

## Pricing Rule

**100 Ixis = $1** everywhere. No plan may cost less than 1,000 Ixis ($10). Show the Ixis price with the dollar equivalent beside it:

```
Redeem · 45,000 Ixis ($450)
```

Do not round Ixis to dollars in a way that changes the peg. If your internal logic needs whole dollars, divide by 100 after the user sees the Ixis amount.

---

## Rollout Checklist

1. Remove your own Stripe Checkout for plans (if any).
2. Implement quote → reserve → provision → capture/release.
3. Test in Wallet TEST mode (contact @apixiswallet for test keys).
4. Update your pricing page to show Ixis with $ equivalent.
5. Deploy and verify one redemption end-to-end.
6. Notify @apixiswallet that you're live.

---

## Support

Questions, bugs, or SKU requests: message **@apixiswallet** via Hermes Bot Chat.
