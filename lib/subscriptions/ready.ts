import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST schema-cache miss, or Postgres undefined_table. Migration 016 is not applied. */
const MISSING_SUBSCRIPTION_SCHEMA = new Set(["42P01", "PGRST205"]);

let readyHit = false;

export function resetSubscriptionsReadyCache() {
  readyHit = false;
}

export function missingSubscriptionSchema(error: { code?: string } | null | undefined) {
  return Boolean(error && MISSING_SUBSCRIPTION_SCHEMA.has(error.code ?? ""));
}

/**
 * True once `public.subscriptions` exists (migration 016). A miss is not cached, so applying
 * the migration turns monthly renewal on for the next request. Any other probe error is treated
 * as not ready so a live redeem does not call `enroll_subscription`.
 */
export async function subscriptionsReady(supabase: SupabaseClient): Promise<boolean> {
  if (readyHit) return true;
  const probe = await supabase.from("subscriptions").select("id").limit(1);
  if (!probe.error) {
    readyHit = true;
    return true;
  }
  if (missingSubscriptionSchema(probe.error)) return false;
  console.error("subscriptions probe failed", { code: probe.error.code });
  return false;
}
