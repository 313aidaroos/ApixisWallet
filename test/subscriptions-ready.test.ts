import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { missingSubscriptionSchema, resetSubscriptionsReadyCache, subscriptionsReady } from "../lib/subscriptions/ready";

function probeClient(error: { code: string } | null): SupabaseClient {
  return {
    from() {
      return {
        select() {
          return {
            limit: async () => ({ data: error ? null : [], error }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("subscriptions schema gate", () => {
  it("treats a missing table as not ready and does not cache the miss", async () => {
    resetSubscriptionsReadyCache();
    assert.equal(missingSubscriptionSchema({ code: "PGRST205" }), true);
    assert.equal(missingSubscriptionSchema({ code: "42P01" }), true);
    assert.equal(missingSubscriptionSchema({ code: "23514" }), false);
    assert.equal(await subscriptionsReady(probeClient({ code: "PGRST205" })), false);
    assert.equal(await subscriptionsReady(probeClient(null)), true);
    assert.equal(await subscriptionsReady(probeClient({ code: "PGRST205" })), true);
    resetSubscriptionsReadyCache();
  });
});
