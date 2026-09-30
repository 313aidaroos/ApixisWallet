import test from "node:test";
import assert from "node:assert/strict";
import { checkLimits, rateLimit, resetRateLimits } from "../lib/api/rate-limit";

test("rate limit: allows up to the limit inside a window, then refuses with a retry hint", () => {
  resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.deepEqual(rateLimit("client:a", 3, 60_000, t0 + i), { ok: true });
  const refused = rateLimit("client:a", 3, 60_000, t0 + 10_000);
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.retryAfterSec, 50);
});

test("rate limit: a new window resets the count and keys are independent", () => {
  resetRateLimits();
  const t0 = 5_000_000;
  assert.equal(rateLimit("owner:x", 1, 1_000, t0).ok, true);
  assert.equal(rateLimit("owner:x", 1, 1_000, t0 + 1).ok, false);
  assert.equal(rateLimit("owner:y", 1, 1_000, t0 + 1).ok, true);
  assert.equal(rateLimit("owner:x", 1, 1_000, t0 + 1_000).ok, true);
});

test("checkLimits: returns a 429 with Retry-After once any limit trips", async () => {
  resetRateLimits();
  const checks = [
    { key: "client:c", limit: 100, windowMs: 60_000 },
    { key: "owner:o", limit: 2, windowMs: 60_000 },
  ];
  assert.equal(checkLimits(checks), null);
  assert.equal(checkLimits(checks), null);
  const response = checkLimits(checks);
  assert.ok(response);
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
  assert.equal((await response.json()).code, "rate_limited");
});
