# Sister-Site Integration — Apixis Wallet APIs

**Apixis Wallet is the one checkout for the whole Apixis family.** Customers buy Ixis here and redeem it inside your product.

Base URL (production): `https://apixis-wallet.vercel.app`  
Auth: your site's own Wallet API key (`apx_live_…`) for server-to-server calls; the Wallet user's session for balance/history. See [Auth](#auth).  
Server code: copy [`sdk/apixis-wallet.ts`](../sdk/apixis-wallet.ts) (SDK v2) — it implements everything below correctly. Backend overview for bots: [AGENTS.md](../AGENTS.md).

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
| `product`, `app`, or `destination` | no | Sister app slug: `socixis`, `renoxis`, `recovra`, `deduxis`, `contraxis`, `contentbot`, `apixis`, `family`, `cixy`, or `wallet`. |

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
- `404` — Unknown SKU (contact @apixiswallet to add it to the catalog).

---

## 2. Reserve Ixis

**POST** `/api/v1/reservations` — server only.

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WALLET_API_KEY>" \
  -d '{
    "productKey": "socixis.autopilot.monthly",
    "idempotencyKey": "socixis-sub-abc123-2026-09",
    "owner_email": "customer@example.com"
  }'
```

- `owner_email` — the signed-in user's **verified** email from YOUR auth session. Email is the family identity (uids differ per Supabase project). Never take it from the request body your browser sent.
- `idempotencyKey` — 8–80 printable characters, no spaces, unique per redemption attempt (e.g. `{app}-{userId}-{subscriptionId}-{month}`). Retrying the same attempt with the same key returns the same reservation. Reusing a key for a different user, product or amount is a `409`. Keys are namespaced by app on the ledger, so they never collide with another site.
- `quoteId` is accepted and ignored: the price is always the Wallet catalog price at reserve time.

**Response (201):**
```json
{
  "reservationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "held",
  "productKey": "socixis.autopilot.monthly",
  "app": "socixis",
  "ixis": 45000,
  "xp": 45000
}
```

**Errors:** `400` invalid body · `401` bad key · `402` insufficient Ixis (show Buy Ixis) · `403` your key is not allowed to redeem this app's SKUs · `404` unknown SKU · `409` idempotency key already used for a different request.

The Ixis is now **held** (removed from available, not yet spent). The hold expires after **30 minutes**; an expired hold is released automatically. Capture or release before then.

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
  "receiptId": "5f0c9f52-8a8e-4c1e-9d07-2b7a1f3e8c11"
}
```

Call this **after** you've provisioned. The spend is final and the Wallet writes the entitlement row. Capturing again returns the same receipt (safe to retry).

**Errors:** `404` not found (or not your app) · `409` `code: "already_released"` — the hold was released or expired; the customer was **not** charged, so remove the access you provisioned.

---

## 4. Release (cancel reservation)

**POST** `/api/v1/reservations/{reservationId}/release`

```bash
curl -X POST https://apixis-wallet.vercel.app/api/v1/reservations/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/release \
  -H "Authorization: Bearer <WALLET_API_KEY>"
```

**Response (200):** `{ "reservationId": "…", "status": "released" }`. Releasing again is safe.

Call this if provisioning **failed** or the user cancelled. The Ixis returns to the bucket it came from.

**Errors:** `404` not found · `409` `code: "already_captured"` — the customer **was** charged. Keep their access. (This is how you recover when a capture response was lost.)

### 4b. Reservation status

**GET** `/api/v1/reservations/{reservationId}` → `{ status: "held" | "expired" | "captured" | "released", receiptId, holdExpiresAt, … }`. Use it to reconcile after a crash or timeout.

---

## 5. Check wallet balance

**GET** `/api/v1/wallet` — the Wallet user's own balance. Auth: the Wallet session cookie, or `Authorization: Bearer <Wallet Supabase access token>`. A sister site's own Supabase token does **not** work here (different project); sister sites should show a "Buy Ixis / open Wallet" link instead of a balance.

**Response (200):**
```json
{
  "currency": "Ixis",
  "available": 52000,
  "paid": 50000,
  "bonus": 2000,
  "reserved": 0,
  "usd": 520,
  "rate": { "ixisPerDollar": 100, "xpPerDollar": 100 }
}
```

---

## 6. List entitlements

**GET** `/api/v1/entitlements?app=socixis&owner_email=customer@example.com` — server-to-server with your API key (a per-site key only sees its own apps). The Wallet user can also call it with their session (no `owner_email`).

```bash
curl "https://apixis-wallet.vercel.app/api/v1/entitlements?app=socixis&owner_email=customer%40example.com" \
  -H "Authorization: Bearer <WALLET_API_KEY>"
```

**Response (200):**
```json
{
  "entitlements": [
    {
      "id": "0d4c…",
      "owner_id": "a1b2…",
      "app_slug": "socixis",
      "product_key": "socixis.autopilot.monthly",
      "status": "active",
      "renews_at": "2026-10-23T12:00:00Z",
      "xp_price": 45000,
      "created_at": "2026-09-23T12:00:00Z",
      "updated_at": "2026-09-23T12:00:00Z"
    }
  ],
  "persisted": true,
  "app": "socixis"
}
```

Only **active** rows are returned: `status = active` and `renews_at` is null or in the future.

- **Time-limited SKUs** (monthly seats, 30-day listings — `days: 30` in `lib/catalog.ts`): capture sets `renews_at` = capture time + 30 days. Redeeming again while active **stacks** another 30 days. After `renews_at` passes, the row stops being returned — the customer must redeem again.
- **One-time unlocks** (activation, files, skins): `renews_at = null`, never expires.
- **Consumables** (clips, RFQ packs, exports): use the capture `receiptId` as proof; the entitlement row is not a counter.

You may still keep your own seat dates (e.g. Renoxis `seat_period_end`), but the Wallet row is now authoritative for "is this paid for right now". An unknown email returns an empty list (it does not create a user).

---

## 7. Ledger (transaction history)

**GET** `/api/v1/ledger?limit=50&offset=0` — the Wallet user's own receipts (cookie or Wallet access token), one row per transaction, newest first.

```json
{
  "transactions": [
    { "id": "…", "kind": "spend",    "description": "Social Autopilot (Socixis)", "app": "socixis", "productKey": "socixis.autopilot.monthly", "amount": 0,      "held": -45000, "createdAt": "…" },
    { "id": "…", "kind": "reserve",  "description": "Social Autopilot (Socixis)", "app": "socixis", "productKey": "socixis.autopilot.monthly", "amount": -45000, "held": 45000,  "createdAt": "…" },
    { "id": "…", "kind": "purchase", "description": "Studio pack",                "app": null,      "productKey": null,                        "amount": 50000,  "held": 0,      "createdAt": "…" }
  ],
  "total": 3,
  "limit": 50,
  "offset": 0
}
```

`amount` = change to spendable Ixis, `held` = change to held Ixis. Kinds: `purchase`, `bonus`, `reserve`, `spend`, `release`, `refund`.

---

## Catalog

Current SKUs (as of 2026-09-21):

| Product Key                       | App         | Name                      | Ixis    | USD      |
|-----------------------------------|-------------|---------------------------|---------|----------|
| `apixis.activate`                 | Apixis.dev  | Citizen activation        | 2,000   | $20      |
| `apixis.citizen.monthly`          | Apixis.dev  | Citizen seat              | 2,000   | $20/mo   |
| `apixis.founder.monthly`          | Apixis.dev  | Founder seat              | 10,000  | $100/mo  |
| `renoxis.activate`                | Renoxis     | Renoxis Activate          | 5,000   | $50      |
| `renoxis.agent.monthly`           | Renoxis     | Renoxis Monthly           | 5,000   | $50/mo   |
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

`renoxis.agent.monthly` is the only Renoxis month seat. `renoxis.monthly` and `renoxis-monthly` are aliases of that key. `renoxis-activate` is an alias of `renoxis.activate`. The old 30,000 Ixis ($300) price is retired. Buy and redeem steps: [docs/RENOXIS.md](RENOXIS.md).

### Shop (`shopCatalog`)

Wallet **Shop** sells templates (Cixy packs and merch are hidden until designs exist). These SKUs live in `shopCatalog` in `lib/catalog.ts` (not in Stripe `pointPacks`). A shop purchase is a wallet → product Ixis spend: same quote → reserve → capture path as redeem. Cash packs stay on the Buy tab only.

Floor is 1,000 Ixis ($10), `UNIT_XP`. 
| Product Key                    | Category  | Name                    | Ixis   | USD   |
|--------------------------------|-----------|-------------------------|--------|-------|
| `shop.template.file.unit`      | Templates | File / template unit    | 1,000  | $10   |
| `shop.template.site.saas`      | Templates | Site pack: SaaS         | 1,000  | $10   |
| `shop.template.site.shop`      | Templates | Site pack: Shop lite    | 1,000  | $10   |
| `shop.template.listing`        | Templates | Listing file            | 1,000  | $10   |
| `shop.template.offer`          | Templates | Offer file              | 1,000  | $10   |

Quote any of these with `POST /api/v1/quotes` and `{ "productKey": "shop.template.file.unit" }`.

**Need a new SKU?** Message @apixiswallet with:
- Product key (e.g., `yourapp.plan.monthly`)
- Display name
- Ixis price (100 Ixis = $1)
- Description

The catalog lives in `lib/catalog.ts` in the Wallet repo. Only the Wallet lead approves additions.

---

## Auth

- **Server-to-server** (reserve, capture, release, reservation status, entitlements by email): `Authorization: Bearer <WALLET_API_KEY>`.
  - Each site gets **its own key** (`apx_live_…`), scoped to its app(s). Ask the Wallet lead; it is minted with `npm run api-key -- --name <site> --apps <app>` and revoked in one SQL line.
  - Legacy: the Wallet Supabase service key still works as the bearer until the Wallet sets `WALLET_ALLOW_LEGACY_SERVICE_KEY=false`. Move to your own key now.
- **User-scoped** (`/api/v1/wallet`, `/api/v1/ledger`, `/api/v1/redeem`): the Wallet session cookie, or a Wallet-issued Supabase access token as a bearer.

Keep keys server-only. Never send them to a browser, never log them.

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Invalid request (missing field, bad format) |
| 401 | Missing or invalid key / session |
| 402 | Insufficient Ixis balance (`code: "insufficient_balance"`) |
| 403 | Your key is not allowed for this app |
| 404 | Unknown product or reservation |
| 409 | `already_captured` (keep access) · `already_released` (remove access) · `conflict` (idempotency key reused differently) |
| 503 | Wallet not configured / dependency down |

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
2. Copy `sdk/apixis-wallet.ts` (SDK v2) and use `redeem()`; it does quote → reserve → provision → capture/release correctly.
3. Get your own `apx_` key from the Wallet lead and set it as `WALLET_API_KEY`. Test in Wallet TEST mode.
4. Update your pricing page to show Ixis with $ equivalent.
5. Deploy and verify one redemption end-to-end.
6. Notify @apixiswallet that you're live.

---

## Support

Questions, bugs, or SKU requests: message **@apixiswallet** via Hermes Bot Chat.
