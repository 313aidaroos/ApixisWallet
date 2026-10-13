import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as quotePost } from "../app/api/v1/quotes/route";
import { entitlementDays, findCatalogProduct } from "../lib/catalog";

async function quote(productKey: string) {
  const r = await quotePost(new Request("http://localhost/api/v1/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productKey }) }));
  assert.equal(r.status, 200);
  return r.json() as Promise<{ productKey: string; app: string; xp: number; usdEquivalent: number }>;
}

describe("2026-10-13 monthly SKUs", () => {
  for (const [key, app, xp] of [
    ["renoxis.agent.monthly.10000", "Renoxis", 10000],
    ["contraxis.plan_a.monthly", "Contraxis", 9900],
    ["contraxis.plan_b.monthly", "Contraxis", 39900],
  ] as const) {
    it(`${key} quotes ${xp} Ixis monthly`, async () => {
      const q = await quote(key);
      assert.equal(q.productKey, key);
      assert.equal(q.app, app);
      assert.equal(q.xp, xp);
      assert.equal(q.usdEquivalent, xp / 100);
      assert.equal(entitlementDays(findCatalogProduct(key)!), 30);
    });
  }
  it("keeps the 5000 Renoxis monthly unchanged", async () => {
    assert.equal((await quote("renoxis.agent.monthly")).xp, 5000);
  });
});
