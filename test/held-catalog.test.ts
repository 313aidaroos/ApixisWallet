import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findCatalogProduct, heldCatalog, redeemCatalog } from "../lib/catalog";
import { productsForDestination } from "../lib/checkout/destinations";

describe("held catalog", () => {
  it("never sells a held product", () => {
    assert.equal(heldCatalog.length, 7);
    for (const item of heldCatalog) {
      assert.equal(findCatalogProduct(item.key), undefined, item.key);
      assert.ok(!redeemCatalog.some((p) => (p.key as string) === item.key), item.key);
    }
  });

  it("sells the Socixis products Socixis delivers: Autopilot, skins and the all-skins pack", () => {
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

  it("keeps the avatar base and site packs held", () => {
    for (const key of ["socixis.avatar.base", "socixis.site.saas", "socixis.site.agency"]) {
      assert.equal(findCatalogProduct(key), undefined, key);
    }
  });
});
