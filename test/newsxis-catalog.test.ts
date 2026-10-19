import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entitlementDays, findCatalogProduct } from "../lib/catalog";
import { productsForDestination } from "../lib/checkout/destinations";
import { isMonthlySku } from "../lib/subscriptions";

describe("Newsxis catalog", () => {
  it("sells Newsxis Activate (newsxis.activate) at 1000 Ixis, one-time, no aliases", () => {
    const product = findCatalogProduct("newsxis.activate");
    assert.ok(product);
    assert.equal(product.key, "newsxis.activate");
    assert.equal(product.name, "Newsxis Activate");
    assert.equal(product.app, "Newsxis");
    assert.equal(product.xp, 1000);
    assert.equal("includes" in product ? product.includes : "", "One-time activation · $10.00");
    assert.equal(entitlementDays(product), null);
    assert.equal((product as { days?: number }).days, undefined);
    assert.equal(isMonthlySku("newsxis.activate"), false);
    assert.equal(findCatalogProduct("newsxis-activate"), undefined);
    assert.equal(findCatalogProduct("newsxis.activate.monthly"), undefined);
    assert.ok(productsForDestination("newsxis").some((item) => item.key === "newsxis.activate"));
  });

  it("sells Newsxis Reporter (newsxis.reporter.monthly) at 1000 Ixis for 30 days, monthly-gated, no aliases", () => {
    const product = findCatalogProduct("newsxis.reporter.monthly");
    assert.ok(product);
    assert.equal(product.key, "newsxis.reporter.monthly");
    assert.equal(product.name, "Newsxis Reporter");
    assert.equal(product.app, "Newsxis");
    assert.equal(product.xp, 1000);
    assert.equal("includes" in product ? product.includes : "", "Month seat · $10.00/mo");
    assert.equal(entitlementDays(product), 30);
    assert.equal(isMonthlySku("newsxis.reporter.monthly"), true);
    assert.equal(findCatalogProduct("newsxis-reporter-monthly"), undefined);
    assert.equal(findCatalogProduct("newsxis.monthly"), undefined);
    assert.equal(findCatalogProduct("newsxis.reporter"), undefined);
    assert.ok(productsForDestination("newsxis").some((item) => item.key === "newsxis.reporter.monthly"));
  });
});
