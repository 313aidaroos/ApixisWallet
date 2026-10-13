import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as quotePost } from "../app/api/v1/quotes/route";
import { entitlementDays, findCatalogProduct } from "../lib/catalog";

async function quote(productKey: string) {
  const r = await quotePost(
    new Request("http://localhost/api/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productKey }),
    }),
  );
  assert.equal(r.status, 200);
  return r.json() as Promise<{ productKey: string; app: string; name: string; xp: number; usdEquivalent: number }>;
}

const LYRIXIS_COLOR = "#22d3ee";

describe("2026-10-13 Lyrixis voice and Socixis plan SKUs", () => {
  for (const [key, app, name, xp, days] of [
    ["lyrixis.voice.setup", "Lyrixis", "Voice setup", 500, null],
    ["lyrixis.voice.song", "Lyrixis", "Voice song", 600, null],
    ["lyrixis.voice.take", "Lyrixis", "Extra take", 100, null],
    ["lyrixis.voice.release", "Lyrixis", "Release to streaming", 900, null],
    ["lyrixis.all_access.monthly", "Lyrixis", "All-Access", 3000, 30],
    ["socixis.creator.monthly", "Socixis", "Creator", 5000, 30],
    ["socixis.small_business.monthly", "Socixis", "Small Business", 30000, 30],
  ] as const) {
    it(`${key} quotes ${xp} Ixis`, async () => {
      const q = await quote(key);
      assert.equal(q.productKey, key);
      assert.equal(q.app, app);
      assert.equal(q.name, name);
      assert.equal(q.xp, xp);
      assert.equal(q.usdEquivalent, xp / 100);
      const product = findCatalogProduct(key);
      assert.equal(product?.key, key);
      assert.equal(entitlementDays(product!), days);
      if (app === "Lyrixis") assert.equal(product && "color" in product ? product.color : "", LYRIXIS_COLOR);
    });
  }

  it("All-Access includes the voice model, four songs, and one release", () => {
    const product = findCatalogProduct("lyrixis.all_access.monthly");
    assert.equal(
      product && "includes" in product ? product.includes : "",
      "Voice model + 4 songs + 1 release/mo",
    );
  });

  it("does not alias the new keys", async () => {
    for (const key of [
      "lyrixis-voice-setup",
      "lyrixis.voice.setup.monthly",
      "socixis-creator",
      "socixis.creator",
      "socixis.small-business.monthly",
    ]) {
      const r = await quotePost(
        new Request("http://localhost/api/v1/quotes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productKey: key }),
        }),
      );
      assert.equal(r.status, 404, key);
    }
  });

  it("keeps lyrixis.track.unlock and socixis.autopilot.monthly unchanged", async () => {
    const track = await quote("lyrixis.track.unlock");
    assert.equal(track.name, "Unlock 1 track export");
    assert.equal(track.xp, 300);
    assert.equal(track.usdEquivalent, 3);
    assert.equal(entitlementDays(findCatalogProduct("lyrixis.track.unlock")!), null);

    const autopilot = await quote("socixis.autopilot.monthly");
    assert.equal(autopilot.name, "Social Autopilot");
    assert.equal(autopilot.xp, 45000);
    assert.equal(autopilot.usdEquivalent, 450);
    assert.equal(entitlementDays(findCatalogProduct("socixis.autopilot.monthly")!), 30);
  });
});
