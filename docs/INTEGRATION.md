# Sister-Site Integration — Apixis Wallet APIs

**Apixis Wallet is the one checkout for the whole Apixis family.** Customers buy Ixis here and redeem it inside your product.

Base URL (production): `https://apixis-wallet.vercel.app`  
Auth: Bearer token with Apixis ID (service-role key for server-to-server).

## Flow

1. **Quote** — GET the Ixis price for your SKU.
2. **Show** — Display "Redeem · 15,000 Ixis ($150)" to the user.
3. **Reserve** — Hold the Ixis when the user clicks Redeem (idempotent).
4. **Provision** — Perform your action (create subscription, unlock feature, etc.).
5. **Capture** — Finalize the spend if provision succeeded.
6. **Release** — Return the Ixis if provision failed or timed out.

Never run your own Stripe Checkout for plans. Ixis-only redemptions keep the family commerce clean.

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
- `400` — Missing or invalid request.
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
