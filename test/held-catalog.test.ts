import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findCatalogProduct, freeCatalog, redeemCatalog, shopCatalog } from "../lib/catalog";
import { productsForDestination } from "../lib/checkout/destinations";

// 2026-10-04 (Grok, Socixis request, Awad approved): avatar base + website packs free; paid 90s/120s renders.
describe("Socixis catalog", () => {
  it("lists the avatar base and every website pack as free and never quotes them", () => {
    assert.deepEqual(
      freeCatalog.map((item) => item.key).sort(),
      [
        "shop.template.site.saas",
        "shop.template.site.shop",
        "socixis.avatar.base",
        "socixis.site.agency",
        "socixis.site.local",
        "socixis.site.portfolio",
        "socixis.site.restaurant",
        "socixis.site.saas",
        "socixis.site.shop",
      ],
    );
    for (const item of freeCatalog) {
      assert.equal(item.xp, 0, item.key);
      // reserve_xp rejects a zero amount, so a free item must never reach quote/reserve.
      assert.equal(findCatalogProduct(item.key), undefined, item.key);
      assert.ok(!redeemCatalog.some((p) => (p.key as string) === item.key), item.key);
      assert.ok(!shopCatalog.some((p) => (p.key as string) === item.key), item.key);
    }
  });

  it("sells the four paid avatar render tiers (45s/60s/90s/120s) as one-time consumables, no paid 30s", () => {
    const socixis: string[] = productsForDestination("socixis").map((p) => p.key);
    for (const [key, xp] of [
      ["socixis.avatar.render.45s", 1500],
      ["socixis.avatar.render.60s", 2000],
      ["socixis.avatar.render.90s", 3000],
      ["socixis.avatar.render.120s", 4000],
    ] as const) {
      const product = findCatalogProduct(key);
      assert.ok(product, key);
      assert.equal(product.xp, xp);
      assert.equal(product.app, "Socixis");
      assert.equal((product as { days?: number }).days, undefined, `${key} is per render, not a period`);
      assert.ok(socixis.includes(key), key);
    }
    // Free avatar videos are capped at 30s on the Socixis side; there is no paid 30s SKU.
    assert.equal(findCatalogProduct("socixis.avatar.render.30s"), undefined);
  });

  it("sells Content Studio image generation (socixis.image.generate) at 25 Ixis per image, as Socixis PR #67 sends it", () => {
    const socixis: string[] = productsForDestination("socixis").map((p) => p.key);
    const product = findCatalogProduct("socixis.image.generate");
    assert.ok(product, "socixis.image.generate");
    assert.equal(product.key, "socixis.image.generate");
    assert.equal(product.xp, 25);
    assert.equal(product.app, "Socixis");
    assert.equal((product as { days?: number }).days, undefined, "per image, not a period");
    assert.ok(socixis.includes("socixis.image.generate"));
  });

  it("still sells the Socixis products Socixis delivers: Autopilot, skins and the all-skins pack", () => {
    const socixis: string[] = productsForDestination("socixis").map((p) => p.key);
    for (const key of [
      "socixis.autopilot.monthly",
      "socixis.avatar.pack.all",
      ...["cartoon", "anime", "hero", "retro", "character", "digital"].map((s) => `socixis.avatar.skin.${s}`),
    ]) {
      assert.ok(findCatalogProduct(key), key);
      assert.ok(socixis.includes(key), key);
    }
  });

  it("every paid catalog price is positive (reserve_xp rejects 0)", () => {
    for (const item of [...redeemCatalog, ...shopCatalog]) assert.ok(item.xp > 0, item.key);
  });
});
