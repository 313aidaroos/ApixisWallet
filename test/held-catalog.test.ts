import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findCatalogProduct, heldCatalog, redeemCatalog } from "../lib/catalog";
import { productsForDestination } from "../lib/checkout/destinations";

describe("held catalog", () => {
  it("never sells a held product", () => {
    assert.equal(heldCatalog.length, 14);
    for (const item of heldCatalog) {
      assert.equal(findCatalogProduct(item.key), undefined, item.key);
      assert.ok(!redeemCatalog.some((p) => p.key === item.key), item.key);
    }
  });

  it("keeps the Socixis products that are delivered", () => {
    assert.ok(findCatalogProduct("socixis.autopilot.monthly"));
    const socixis = productsForDestination("socixis").map((p) => p.key);
    assert.ok(socixis.includes("socixis.autopilot.monthly"));
    assert.ok(!socixis.some((k) => k.startsWith("socixis.avatar.") || k.startsWith("socixis.site.")));
  });
});
