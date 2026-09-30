import { NextResponse } from "next/server";

/**
 * Burst protection for the money routes (reserve / redeem / SSO token exchange).
 *
 * Fixed window, in memory, per serverless instance. It stops a runaway retry loop or a leaked
 * key from hammering the ledger; it is not a substitute for the Vercel WAF rules (AGENTS.md §9),
 * because every warm instance keeps its own counters. Limits are deliberately generous for real
 * traffic: a site reserving a few hundred holds a minute is fine, a loop firing thousands is not.
 *
 * Keys are `<scope>:<id>` — e.g. `client:<wallet_api_clients.id>` or `owner:<wallet user id>`.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  return { ok: true };
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  // Still full (a real flood): drop the oldest half rather than grow without bound.
  if (buckets.size >= MAX_BUCKETS) {
    let drop = Math.floor(buckets.size / 2);
    for (const key of buckets.keys()) {
      if (drop-- <= 0) break;
      buckets.delete(key);
    }
  }
}

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}

export const LIMITS = {
  /** One site's key: holds it may open per minute. */
  clientReserve: { limit: 300, windowMs: 60_000 },
  /** One person: holds opened in their name per minute, across every site. */
  ownerReserve: { limit: 30, windowMs: 60_000 },
  /** One person redeeming from inside the Wallet UI. */
  walletRedeem: { limit: 20, windowMs: 60_000 },
  /** One site's key: Apixis ID code exchanges per minute. */
  ssoToken: { limit: 120, windowMs: 60_000 },
} as const;

/** 429 with Retry-After, in the same shape as the other route errors. */
export function rateLimitedResponse(result: { retryAfterSec: number }) {
  return NextResponse.json(
    { error: "Too many requests", code: "rate_limited", retryAfterSec: result.retryAfterSec },
    { status: 429, headers: { "retry-after": String(result.retryAfterSec), "cache-control": "no-store" } },
  );
}

/** First limit that trips wins; null when every one passes. */
export function checkLimits(checks: { key: string; limit: number; windowMs: number }[]) {
  for (const check of checks) {
    const result = rateLimit(check.key, check.limit, check.windowMs);
    if (!result.ok) return rateLimitedResponse(result);
  }
  return null;
}
