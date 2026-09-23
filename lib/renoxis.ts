import { findCatalogProduct } from "@/lib/catalog";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export type RenoxisGrant = {
  productKey: "renoxis.activate" | "renoxis.agent.monthly";
  app: "renoxis";
  status: "active";
  renewsAt: string | null;
  xpPrice: number;
};

/**
 * Grant shape after a successful capture (mirrors the row capture_xp writes; see migration 007).
 * This does not read or write a balance. Renoxis calls quote → reserve → provision → capture
 * (SDK v2 redeem()). Idempotency keys:
 * activate `renoxis-{userId}-activate`, seat `renoxis-{userId}-seat-{YYYY-MM}`.
 */
export function renoxisEntitlementAfterCapture(productKey: string, capturedAt: Date): RenoxisGrant | null {
  const product = findCatalogProduct(productKey);
  if (!product) return null;
  if (product.key === "renoxis.activate") {
    return {
      productKey: "renoxis.activate",
      app: "renoxis",
      status: "active",
      renewsAt: null,
      xpPrice: product.xp,
    };
  }
  if (product.key === "renoxis.agent.monthly") {
    return {
      productKey: "renoxis.agent.monthly",
      app: "renoxis",
      status: "active",
      renewsAt: new Date(capturedAt.getTime() + MONTH_MS).toISOString(),
      xpPrice: product.xp,
    };
  }
  return null;
}
