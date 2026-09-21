import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as quote } from "../app/api/v1/quotes/route";
import { POST as reserve } from "../app/api/v1/reservations/route";
import {
  cosmeticsCatalog,
  findCatalogProduct,
  isComingSoonCatalogItem,
  shopCatalog,
} from "../lib/catalog";

const EXPECTED = [
  ["cixy.cosmetic.outfit.starter", "outfit", "Starter suit", "outfit.starter"],
  ["cixy.cosmetic.outfit.executive", "outfit", "Executive", "outfit.executive"],
  ["cixy.cosmetic.outfit.street", "outfit", "Street", "outfit.street"],
  ["cixy.cosmetic.outfit.formal", "outfit", "Formal", "outfit.formal"],
  ["cixy.cosmetic.theme.midnight", "theme", "Midnight", "theme.midnight"],
  ["cixy.cosmetic.theme.dawn", "theme", "Dawn", "theme.dawn"],
  ["cixy.cosmetic.theme.neon", "theme", "Neon", "theme.neon"],
  ["cixy.cosmetic.theme.paper", "theme", "Paper", "theme.paper"],
  ["cixy.cosmetic.template.brief", "template", "Brief pack", "template.brief"],
  ["cixy.cosmetic.template.standup", "template", "Standup pack", "template.standup"],
  ["cixy.cosmetic.template.client", "template", "Client pack", "template.client"],
  ["cixy.cosmetic.template.ops", "template", "Ops pack", "template.ops"],
  ["cixy.cosmetic.office.desk", "office", "Desk", "office.desk"],
  ["cixy.cosmetic.office.warroom", "office", "War room", "office.warroom"],
  ["cixy.cosmetic.office.lounge", "office", "Lounge", "office.lounge"],
  ["cixy.cosmetic.office.studio", "office", "Studio", "office.studio"],
] as const;

async function postJson(handler: (request: Request) => Promise<Response>, path: string, body: unknown) {
  return handler(new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("cosmetics catalog", () => {
  it("lists the authoritative coming-soon rows and no accessory or anim SKUs", () => {
    assert.deepEqual(
      cosmeticsCatalog.map((item) => [item.key, item.group, item.name, item.unlockAssetId]),
      EXPECTED,
    );
    for (const item of cosmeticsCatalog) {
      assert.equal(item.xp, null);
      assert.equal(item.status, "coming_soon");
      assert.equal(item.app, "Cixy");
      assert.equal(isComingSoonCatalogItem(item), true);
      assert.equal(findCatalogProduct(item.key), item);
    }
    const keys = cosmeticsCatalog.map((item) => item.key);
    assert.equal(keys.some((key) => key.startsWith("cixy.cosmetic.accessory.")), false);
    assert.equal(keys.some((key) => key.startsWith("cixy.cosmetic.anim.")), false);
  });

  it("keeps legacy voice, skin, and persona as priced shop packs", () => {
    for (const key of ["shop.cixy.voice", "shop.cixy.skin", "shop.cixy.persona"] as const) {
      const item = shopCatalog.find((row) => row.key === key);
      assert.ok(item);
      assert.equal(item.category, "cixy");
      assert.equal(typeof item.xp, "number");
      assert.ok(item.xp > 0);
      assert.equal(isComingSoonCatalogItem(item), false);
      assert.equal(findCatalogProduct(key)?.key, key);
    }
  });
});

describe("coming soon quotes and reserves", () => {
  it("rejects a null-xp cosmetic without echoing a price", async () => {
    const response = await postJson(quote, "/api/v1/quotes", {
      productKey: "cixy.cosmetic.outfit.starter",
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      error: "Coming soon",
      productKey: "cixy.cosmetic.outfit.starter",
      status: "coming_soon",
    });
  });

  it("still quotes a priced SKU at the 100 Ixis = $1 peg", async () => {
    const response = await postJson(quote, "/api/v1/quotes", { productKey: "shop.cixy.voice" });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.xp, 1000);
    assert.equal(body.usdEquivalent, 10);
    assert.equal(body.payable, "xp_only");
  });

  it("returns 404 for an unknown SKU", async () => {
    const response = await postJson(quote, "/api/v1/quotes", { productKey: "cixy.cosmetic.accessory.pin" });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "Unknown redeem SKU");
  });

  it("refuses to reserve a coming-soon cosmetic", async () => {
    const response = await postJson(reserve, "/api/v1/reservations", {
      productKey: "cixy.cosmetic.office.warroom",
      idempotencyKey: "cosmetic-warroom-1",
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "Coming soon");
    assert.equal(body.status, "coming_soon");
    assert.equal("xp" in body, false);
  });
});
