# Cixy cosmetics

Apixis Wallet owns Cixy cosmetics commerce. Sister products do not charge a card for outfits, themes, work templates, or office settings, and they do not keep a second balance. There is no cash-out and no per-product Stripe price for cosmetics.

Prices are Ixis. When a price exists, the peg is **100 Ixis = $1**. Until Awad locks a positive integer for a SKU, `xp` is `null` and `status` is `"coming_soon"`. The browser never supplies the price. Quote and reserve read `lib/catalog.ts` only.

## Shared character

Cosmetics are **shared Cixy assets**. An outfit, theme, work template, or office setting dresses the one family Cixy. A product must not invent a second character, a site-only face, or a twin. Portrait and motion stay the Command HQ Cixy in [CIXY.md](CIXY.md). This catalog does not change Command or `awad-command`.

Work templates (`cixy.cosmetic.template.*`) are Cixy briefs, standups, client packs, and ops packs. They are not Socixis site packs (`socixis.site.*`, `shop.template.site.*`).

`shop.cixy.voice`, `shop.cixy.skin`, and `shop.cixy.persona` stay in `shopCatalog` as legacy packs. They are not aliases of the rows below.

## Catalog

Authoritative rows live in `cosmeticsCatalog` (`lib/catalog.ts`) and are included in `findCatalogProduct`. Namespace: `cixy.cosmetic.*`. Each row has `unlockAssetId` for the product UI that will check the grant later.

| Product key | Name | unlockAssetId | Ixis |
| --- | --- | --- | --- |
| `cixy.cosmetic.outfit.starter` | Starter suit | `outfit.starter` | Coming soon |
| `cixy.cosmetic.outfit.executive` | Executive | `outfit.executive` | Coming soon |
| `cixy.cosmetic.outfit.street` | Street | `outfit.street` | Coming soon |
| `cixy.cosmetic.outfit.formal` | Formal | `outfit.formal` | Coming soon |
| `cixy.cosmetic.theme.midnight` | Midnight | `theme.midnight` | Coming soon |
| `cixy.cosmetic.theme.dawn` | Dawn | `theme.dawn` | Coming soon |
| `cixy.cosmetic.theme.neon` | Neon | `theme.neon` | Coming soon |
| `cixy.cosmetic.theme.paper` | Paper | `theme.paper` | Coming soon |
| `cixy.cosmetic.template.brief` | Brief pack | `template.brief` | Coming soon |
| `cixy.cosmetic.template.standup` | Standup pack | `template.standup` | Coming soon |
| `cixy.cosmetic.template.client` | Client pack | `template.client` | Coming soon |
| `cixy.cosmetic.template.ops` | Ops pack | `template.ops` | Coming soon |
| `cixy.cosmetic.office.desk` | Desk | `office.desk` | Coming soon |
| `cixy.cosmetic.office.warroom` | War room | `office.warroom` | Coming soon |
| `cixy.cosmetic.office.lounge` | Lounge | `office.lounge` | Coming soon |
| `cixy.cosmetic.office.studio` | Studio | `office.studio` | Coming soon |

When Awad sets a price, replace `xp: null` with a positive integer and drop `status: "coming_soon"`. Both have to change. A row that still says `coming_soon` stays unquotable even if a number is filled in by mistake. Dollar display is `xp / 100` at the peg.

### Reserved

Do not add priced SKUs yet:

- `cixy.cosmetic.accessory.*`
- `cixy.cosmetic.anim.*`

## Quote, reserve, grant, capture

Same spend path as any other Wallet SKU, once the integer exists. API detail: [INTEGRATION.md](INTEGRATION.md). Buying Ixis and returning to a customize page: [WALLET_EMBED.md](WALLET_EMBED.md).

1. **Quote** — `POST /api/v1/quotes` with `{ "productKey": "cixy.cosmetic.outfit.starter" }`.
2. **Reserve** — `POST /api/v1/reservations` holds that catalog integer. It does not trust a client price.
3. **Grant** — the product unlocks `unlockAssetId` after a successful reserve. Wallet does not expose a grant API for cosmetics. Product checks should read `unlockAssetId` from this catalog when that hook exists.
4. **Capture** — `POST /api/v1/reservations/{id}/capture` after the grant succeeds. **Release** if the grant fails.

While `xp` is `null` or `status` is `"coming_soon"`, quote and reserve return **400**:

```json
{ "error": "Coming soon", "productKey": "cixy.cosmetic.outfit.starter", "status": "coming_soon" }
```

The body has no `xp`. An unknown key stays **404** `Unknown redeem SKU`.

The Shop shows **Coming soon** and leaves redeem disabled for these rows.
