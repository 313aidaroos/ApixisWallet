# Cixy cosmetics

Apixis Wallet owns Cixy cosmetics commerce. Sister products do not charge a card for outfits, themes, work templates, or office settings, and they do not keep a second balance. There is no cash-out and no per-product Stripe price for cosmetics.

Prices are Ixis. When a price exists, the peg is **100 Ixis = $1**. Until Awad locks a positive integer for a SKU, `xp` is `null` and `status` is `"coming_soon"`. The browser never supplies the price. Quote and reserve read `lib/catalog.ts` only.

## Shared character

Cosmetics are **shared Cixy assets**. An outfit, theme, work template, or office setting dresses the one family Cixy. A product must not invent a second character, a site-only face, or a twin. Portrait and motion stay the Command HQ Cixy in [CIXY.md](CIXY.md). This catalog does not change Command or `awad-command`.

Work templates (`cixy.cosmetic.template.*`) are Cixy briefs, standups, client packs, and ops packs. They are not Socixis site packs (`socixis.site.*`, `shop.template.site.*`).

`shop.cixy.voice`, `shop.cixy.skin`, and `shop.cixy.persona` stay in `shopCatalog` as legacy packs. They are not aliases of the rows below.

## Catalog

Authoritative rows live in `cosmeticsCatalog` (`lib/catalog.ts`) and are included in `findCatalogProduct`. Namespace: `cixy.cosmetic.*`. Each row has `unlockAssetId`. A wardrobe entitlement points at that id. The price still comes from this catalog, not from the browser.

| Product key | Name | unlockAssetId | Ixis |
| --- | --- | --- | --- |
| `cixy.cosmetic.outfit.starter` | Starter suit | `outfit.starter` | Included |
| `cixy.cosmetic.outfit.executive` | Executive | `outfit.executive` | Coming soon |
| `cixy.cosmetic.outfit.street` | Street | `outfit.street` | Coming soon |
| `cixy.cosmetic.outfit.formal` | Formal | `outfit.formal` | Coming soon |
| `cixy.cosmetic.theme.midnight` | Midnight | `theme.midnight` | Coming soon |
| `cixy.cosmetic.theme.dawn` | Dawn | `theme.dawn` | Coming soon |
| `cixy.cosmetic.theme.neon` | Neon | `theme.neon` | Coming soon |
| `cixy.cosmetic.theme.paper` | Paper | `theme.paper` | Included |
| `cixy.cosmetic.template.brief` | Brief pack | `template.brief` | Coming soon |
| `cixy.cosmetic.template.standup` | Standup pack | `template.standup` | Coming soon |
| `cixy.cosmetic.template.client` | Client pack | `template.client` | Coming soon |
| `cixy.cosmetic.template.ops` | Ops pack | `template.ops` | Coming soon |
| `cixy.cosmetic.office.desk` | Desk | `office.desk` | Included |
| `cixy.cosmetic.office.warroom` | War room | `office.warroom` | Coming soon |
| `cixy.cosmetic.office.lounge` | Lounge | `office.lounge` | Coming soon |
| `cixy.cosmetic.office.studio` | Studio | `office.studio` | Coming soon |

When Awad sets a price on a **premium** row, replace `xp: null` with a positive integer and drop `status: "coming_soon"`. Both have to change. A row that still says `coming_soon` stays unquotable even if a number is filled in by mistake. Dollar display is `xp / 100` at the peg. Essentials stay `xp: null`. They are not given a price.

### Reserved

Do not add priced SKUs yet:

- `cixy.cosmetic.accessory.*`
- `cixy.cosmetic.anim.*`

## Wardrobe

Cixy's wardrobe is owned inventory. A purchase is not a one-shot apply, and equipping an item does not burn Ixis again.

1. The user buys a premium outfit, theme, work template, or office on Wallet with Ixis.
2. The grant is a persistent wardrobe entitlement for that user: `app` `cixy`, `kind` `wardrobe`, `productKey`, and `unlockAssetId`. It stays `active`.
3. Any product customize UI opens the wardrobe and equips owned items onto the **same** signature Cixy. There is no second character.
4. An unowned premium piece is locked, with a Buy on Wallet CTA ([WALLET_EMBED.md](WALLET_EMBED.md) customize `return_url`). An owned piece is selectable.
5. Essentials are always owned, before any purchase.

Equip and unequip are product UI state. Wallet has no equip endpoint. They do not call quote, reserve, or capture, and they do not delete the entitlement. Ownership survives taking the piece off.

### Essentials

`WARDROBE_ESSENTIAL_UNLOCK_IDS` in `lib/catalog.ts`:

| unlockAssetId | Piece | Why it is free |
| --- | --- | --- |
| `outfit.starter` | Starter suit | Default suit on the shared Cixy |
| `theme.paper` | Paper | Default theme |
| `office.desk` | Desk | Default office |

No work template is essential. Brief, standup, client, and ops packs are premium. Accessory and animation ids are not in the wardrobe yet.

Essentials are not sold. Quote and reserve return **400** `Included` and no `xp`:

```json
{
  "error": "Included",
  "productKey": "cixy.cosmetic.outfit.starter",
  "status": "owned",
  "kind": "wardrobe",
  "unlockAssetId": "outfit.starter"
}
```

Their catalog `xp` stays `null` and `status` stays `"coming_soon"` so a client cannot invent a premium integer. The Shop shows **Included** and a disabled **Owned** control.

### Read the owned set

Product UIs use the existing entitlements list. Do not add a second grant API.

**GET** `/api/v1/entitlements?app=cixy`

```json
{
  "app": "cixy",
  "entitlements": [
    {
      "id": "wardrobe:outfit.starter",
      "app": "cixy",
      "kind": "wardrobe",
      "productKey": "cixy.cosmetic.outfit.starter",
      "unlockAssetId": "outfit.starter",
      "name": "Starter suit",
      "group": "outfit",
      "status": "active",
      "ownership": "essential",
      "renewsAt": null,
      "xpPrice": 0
    }
  ],
  "message": "Purchased wardrobe rows are not stored yet. These essentials are always owned. Equip does not spend Ixis."
}
```

`kind` is `wardrobe`. `unlockAssetId` is the catalog id the customize UI equips. `xpPrice` is `0` for essentials. A purchased row will record the catalog integer once, at grant, and later reads do not charge it. `renewsAt` is `null` because a wardrobe piece is not a subscription.

Until that write is connected, this route returns **only** the three essentials. It does not invent purchased rows. Other `app` values stay on the empty entitlements stub. Detail: [INTEGRATION.md](INTEGRATION.md).

When a purchase is stored, it uses the existing `entitlements` table: `app_slug` `cixy`, `product_key` the catalog key, `status` `active`, `xp_price` `0` or the catalog integer. `unlockAssetId` is read back from `cosmeticsCatalog`. The table already allows one row per owner, app, and product key, which is the persistent owned id.

Customize UI:

- Owned: `status` `active` and the `unlockAssetId` is in the list. Show it as selectable.
- Unowned premium: the catalog id is missing from that list. Show it locked, with Buy on Wallet. While `xp` is null, Wallet answers **Coming soon** and does not take Ixis.
- Essentials are always in the list, so they are selectable on every product.

## Quote, reserve, grant, capture

Same spend path as any other Wallet SKU, once the integer exists. API detail: [INTEGRATION.md](INTEGRATION.md). Buying Ixis and returning to a customize page: [WALLET_EMBED.md](WALLET_EMBED.md).

1. **Quote** — `POST /api/v1/quotes` with the catalog `productKey`. Essentials return `Included`. Premium rows with `xp: null` return `Coming soon`.
2. **Reserve** — `POST /api/v1/reservations` holds the catalog integer for a priced premium row. It does not trust a client price. Essentials and unpriced rows are refused.
3. **Grant** — capture records a wardrobe entitlement (`kind: "wardrobe"`, `app: "cixy"`, `unlockAssetId` from the catalog). That row is the owned item id. Wallet does not write it yet, and there is no separate grant route.
4. **Capture** — `POST /api/v1/reservations/{id}/capture` after the product can accept the entitlement. **Release** if it cannot. Equip later does not capture again.

While a premium row has `xp: null` or `status` `"coming_soon"`, quote and reserve return **400**:

```json
{ "error": "Coming soon", "productKey": "cixy.cosmetic.outfit.starter", "status": "coming_soon" }
```

The body has no `xp`. An unknown key stays **404** `Unknown redeem SKU`.

The Shop shows **Coming soon** and leaves redeem disabled for these rows.
