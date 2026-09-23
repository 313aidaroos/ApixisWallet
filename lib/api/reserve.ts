import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementDays, findCatalogProduct } from "@/lib/catalog";
import { canonicalAppSlug } from "@/lib/checkout/destinations";

export type CatalogProduct = NonNullable<ReturnType<typeof findCatalogProduct>>;

/** Idempotency keys: 8–80 printable ASCII characters, no spaces. */
export const IDEMPOTENCY_KEY = /^[\x21-\x7E]{8,80}$/;

export function productApp(product: CatalogProduct) {
  return canonicalAppSlug(product.app);
}

/**
 * Keys are namespaced by app on the ledger, so Socixis "order-123" and Renoxis "order-123"
 * are different holds. The ledger additionally refuses a replay whose owner, product or amount differ.
 */
export function ledgerIdempotencyKey(app: string, key: string) {
  return `${app}:${key}`;
}

export async function reserveProduct(
  supabase: SupabaseClient,
  input: { ownerId: string; product: CatalogProduct; idempotencyKey: string; actor: string },
) {
  const app = productApp(input.product);
  return supabase.rpc("reserve_xp", {
    p_owner_id: input.ownerId,
    p_amount: input.product.xp,
    p_description: `${input.product.name} (${input.product.app})`,
    p_external_id: ledgerIdempotencyKey(app, input.idempotencyKey),
    p_app_slug: app,
    p_product_key: input.product.key,
    p_actor: input.actor,
    p_entitlement_days: entitlementDays(input.product),
  });
}
