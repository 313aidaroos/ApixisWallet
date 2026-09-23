import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as quotePost } from "../app/api/v1/quotes/route";
import { GET as entitlementsGet } from "../app/api/v1/entitlements/route";
import { findCatalogProduct, redeemCatalog } from "../lib/catalog";
import { productsForDestination, resolveDestination } from "../lib/checkout/destinations";
import { renoxisEntitlementAfterCapture } from "../lib/renoxis";

const capturedAt = new Date("2026-09-21T00:00:00.000Z");

async function quote(productKey: string) {
  const response = await quotePost(
    new Request("http://localhost/api/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productKey }),
    }),
  );
  assert.equal(response.status, 200);
  return response.json() as Promise<{ productKey: string; xp: number; usdEquivalent: number; name: string }>;
}

describe("Renoxis 5k launch SKUs", () => {
  it("prices activate and the revised monthly at 5000 Ixis ($50)", async () => {
    const activate = await quote("renoxis.activate");
    assert.equal(activate.productKey, "renoxis.activate");
    assert.equal(activate.name, "Renoxis Activate");
    assert.equal(activate.xp, 5000);
    assert.equal(activate.usdEquivalent, 50);

    const monthly = await quote("renoxis.agent.monthly");
    assert.equal(monthly.productKey, "renoxis.agent.monthly");
    assert.equal(monthly.name, "Renoxis Monthly");
    assert.equal(monthly.xp, 5000);
    assert.equal(monthly.usdEquivalent, 50);
  });

  it("resolves hyphen and dotted aliases to the canonical keys", async () => {
    assert.equal(findCatalogProduct("renoxis-activate")?.key, "renoxis.activate");
    assert.equal(findCatalogProduct("renoxis.activate")?.key, "renoxis.activate");
    assert.equal(findCatalogProduct("renoxis-monthly")?.key, "renoxis.agent.monthly");
    assert.equal(findCatalogProduct("renoxis.monthly")?.key, "renoxis.agent.monthly");
    assert.equal(findCatalogProduct("renoxis.agent.monthly")?.xp, 5000);

    const hyphenMonth = await quote("renoxis-monthly");
    assert.equal(hyphenMonth.productKey, "renoxis.agent.monthly");
    assert.equal(hyphenMonth.xp, 5000);
    assert.equal(hyphenMonth.usdEquivalent, 50);
  });

  it("does not keep a 30000 Ixis Renoxis seat or a second monthly key", () => {
    const months = redeemCatalog.filter((item) => item.key.startsWith("renoxis.") && item.key.includes("monthly"));
    assert.deepEqual(months.map((item) => item.key), ["renoxis.agent.monthly"]);
    assert.equal(months[0]?.xp, 5000);
    assert.equal(redeemCatalog.some((item) => item.app === "Renoxis" && Number(item.xp) === 30000), false);
    assert.equal(findCatalogProduct("renoxis-monthly")?.key, findCatalogProduct("renoxis.agent.monthly")?.key);
  });

  it("lists activate and the revised monthly for the renoxis destination", async () => {
    assert.equal(resolveDestination("renoxis")?.slug, "renoxis");
    const products = productsForDestination("renoxis");
    const activate = products.find((item) => item.key === "renoxis.activate");
    const monthly = products.find((item) => item.key === "renoxis.agent.monthly");
    assert.ok(activate);
    assert.ok(monthly);
    assert.equal(activate?.xp, 5000);
    assert.equal(monthly?.xp, 5000);

    const aliasQuote = await quote("renoxis-activate");
    assert.equal(aliasQuote.xp, 5000);
    assert.equal(aliasQuote.usdEquivalent, 50);
    assert.equal(aliasQuote.productKey, "renoxis.activate");
    const monthAlias = await quote("renoxis.monthly");
    assert.equal(monthAlias.productKey, "renoxis.agent.monthly");
    assert.equal(monthAlias.xp, 5000);
    assert.equal(monthAlias.usdEquivalent, 50);
  });

  it("describes capture grants without inventing a stored balance", async () => {
    const activate = renoxisEntitlementAfterCapture("renoxis-activate", capturedAt);
    assert.equal(activate?.productKey, "renoxis.activate");
    assert.equal(activate?.status, "active");
    assert.equal(activate?.renewsAt, null);
    assert.equal(activate?.xpPrice, 5000);

    const seat = renoxisEntitlementAfterCapture("renoxis-monthly", capturedAt);
    assert.equal(seat?.productKey, "renoxis.agent.monthly");
    assert.equal(seat?.status, "active");
    assert.equal(seat?.renewsAt, "2026-10-21T00:00:00.000Z");
    assert.equal(seat?.xpPrice, 5000);

    // entitlementsGet requires auth; calling without returns 401 (secure by design)
    const response = await entitlementsGet(new Request("http://localhost/api/v1/entitlements?app=renoxis"));
    assert.equal(response.status, 401);
  });
});
