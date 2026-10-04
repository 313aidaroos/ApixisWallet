import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SIGNUP_GRANT_DESCRIPTION,
  SIGNUP_GRANT_IXIS,
  ensureSignupGrant,
  grantRateLimited,
  isDisposableEmail,
  signupGrantEligibility,
  signupGrantEnabled,
} from "../lib/signup-grant";
import { resetRateLimits } from "../lib/api/rate-limit";
import { IXIS_MAX_SUPPLY } from "../lib/ixis-asset/supply";
import { PAYOUT_RULE, payoutSplit, settlePayout } from "../lib/api/marketplace";

const migration = readFileSync(new URL("../supabase/migrations/013_signup_grant.sql", import.meta.url), "utf8");

test("kill switch: OFF when unset or anything but an explicit yes", () => {
  const saved = process.env.SIGNUP_GRANT_ENABLED;
  delete process.env.SIGNUP_GRANT_ENABLED;
  try {
    assert.equal(signupGrantEnabled(), false);
    for (const off of [undefined, null, "", "0", "false", "off", "no", "enabled", " tru "]) assert.equal(signupGrantEnabled(off), false, String(off));
    for (const on of ["1", "true", "TRUE", " on ", "yes"]) assert.equal(signupGrantEnabled(on), true, on);
  } finally {
    if (saved === undefined) delete process.env.SIGNUP_GRANT_ENABLED;
    else process.env.SIGNUP_GRANT_ENABLED = saved;
  }
});

test("TS mirrors match the SQL: 1,000 Ixis constant, description, mint ceiling, service_role only", () => {
  assert.equal(SIGNUP_GRANT_IXIS, 1000);
  assert.match(migration, /c_amount constant bigint := 1000;/);
  assert.ok(migration.includes(`c_description constant text := '${SIGNUP_GRANT_DESCRIPTION}'`));
  assert.match(migration, new RegExp(`c_max_supply constant bigint := ${IXIS_MAX_SUPPLY};`));
  assert.match(migration, /revoke all on function %s from public, anon, authenticated/);
  // The amount is not a parameter of grant_signup_xp.
  const signature = migration.slice(migration.indexOf("function public.grant_signup_xp("), migration.indexOf("returns jsonb"));
  assert.doesNotMatch(signature, /amount/);
});

test("disposable domains are refused, including subdomains and the env extension", () => {
  assert.equal(isDisposableEmail("a@mailinator.com", ""), true);
  assert.equal(isDisposableEmail("a@x.mailinator.com", ""), true);
  assert.equal(isDisposableEmail("a@YOPMAIL.com", ""), true);
  assert.equal(isDisposableEmail("a@gmail.com", ""), false);
  assert.equal(isDisposableEmail("a@apixis.dev", ""), false);
  assert.equal(isDisposableEmail("a@burner.example", "burner.example, other.test"), true);
  assert.equal(isDisposableEmail("no-at-sign", ""), true);
});

test("eligibility: confirmed email + a real sign-in, not banned, not disposable", () => {
  const ok = { id: "u1", email: "Person@Example.com", email_confirmed_at: "2026-10-01T00:00:00Z", last_sign_in_at: "2026-10-04T00:00:00Z" };
  assert.deepEqual(signupGrantEligibility(ok), { ok: true, email: "person@example.com" });
  assert.deepEqual(signupGrantEligibility({ ...ok, email_confirmed_at: null }), { ok: false, reason: "email_not_confirmed" });
  // Auto-created by sister-site-redeem and never signed in: no grant until the person actually signs in.
  assert.deepEqual(signupGrantEligibility({ ...ok, last_sign_in_at: null }), { ok: false, reason: "no_sign_in" });
  assert.deepEqual(signupGrantEligibility({ ...ok, email: "" }), { ok: false, reason: "no_email" });
  assert.deepEqual(signupGrantEligibility({ ...ok, email: "x@mailinator.com" }), { ok: false, reason: "disposable_email" });
  assert.deepEqual(
    signupGrantEligibility({ ...ok, banned_until: "2999-01-01T00:00:00Z" }, Date.parse("2026-10-04T00:00:00Z")),
    { ok: false, reason: "banned" },
  );
  assert.equal(signupGrantEligibility(null).ok, false);
  // No signup-date cutoff: an account from long before 9/27 qualifies like a new one.
  assert.equal(signupGrantEligibility({ ...ok, email_confirmed_at: "2026-09-01T00:00:00Z" }).ok, true);
});

test("rate limits: per IP, per custom domain; shared webmail only hits the global cap", () => {
  resetRateLimits();
  const now = 1_000_000;
  for (let i = 0; i < 5; i += 1) assert.equal(grantRateLimited(`p${i}@gmail.com`, "198.51.100.1", now), null);
  assert.equal(grantRateLimited("p6@gmail.com", "198.51.100.1", now), "rate_limited_ip");
  assert.equal(grantRateLimited("p7@gmail.com", "198.51.100.2", now), null);
  resetRateLimits();
  for (let i = 0; i < 25; i += 1) assert.equal(grantRateLimited(`u${i}@farm.example`, null, now), null);
  assert.equal(grantRateLimited("u26@farm.example", null, now), "rate_limited_domain");
  for (let i = 0; i < 40; i += 1) assert.equal(grantRateLimited(`g${i}@gmail.com`, null, now), null);
  resetRateLimits();
});

type Call = { kind: string; args: unknown };

function fakeSupabase(opts: {
  existing?: boolean;
  user?: Record<string, unknown> | null;
  rpc?: { data?: unknown; error?: { code: string } | null };
  throwOn?: string;
}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ kind: "from", args: table });
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (opts.throwOn === "lookup") throw new Error("network");
          return { data: opts.existing ? { owner_id: "u1" } : null, error: null };
        },
      };
      return chain;
    },
    auth: {
      admin: {
        getUserById: async (id: string) => {
          calls.push({ kind: "getUserById", args: id });
          return { data: { user: opts.user === undefined ? null : opts.user }, error: null };
        },
      },
    },
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: `rpc:${name}`, args });
      return { data: opts.rpc?.data ?? null, error: opts.rpc?.error ?? null };
    },
  };
  return { client: client as never, calls };
}

const eligibleUser = { id: "u1", email: "new@example.com", email_confirmed_at: "2026-10-04T00:00:00Z", last_sign_in_at: "2026-10-04T00:00:00Z" };

test("ensureSignupGrant: flag off (default) touches nothing", async () => {
  const { client, calls } = fakeSupabase({ user: eligibleUser, rpc: { data: { granted: true, transaction_id: "t1", amount: 1000 } } });
  const saved = process.env.SIGNUP_GRANT_ENABLED;
  delete process.env.SIGNUP_GRANT_ENABLED;
  try {
    assert.deepEqual(await ensureSignupGrant(client, "u1", { source: "auth_callback" }), { granted: false, skipped: "disabled" });
  } finally {
    if (saved !== undefined) process.env.SIGNUP_GRANT_ENABLED = saved;
  }
  assert.equal(calls.length, 0);
});

test("ensureSignupGrant: grants once via grant_signup_xp with source, ip and user agent", async () => {
  resetRateLimits();
  const { client, calls } = fakeSupabase({ user: eligibleUser, rpc: { data: { granted: true, transaction_id: "t1", amount: 1000 } } });
  const result = await ensureSignupGrant(client, "u1", { source: "password_login", ip: "203.0.113.5", userAgent: "ua" }, { enabled: "true" });
  assert.deepEqual(result, { granted: true, transactionId: "t1", amount: 1000 });
  const rpc = calls.find((c) => c.kind === "rpc:grant_signup_xp");
  assert.deepEqual(rpc?.args, { p_owner_id: "u1", p_source: "password_login", p_actor: "signup-grant:password_login", p_ip: "203.0.113.5", p_user_agent: "ua" });
});

test("ensureSignupGrant: already granted stops before the Admin API and the RPC", async () => {
  const { client, calls } = fakeSupabase({ existing: true, user: eligibleUser });
  assert.deepEqual(await ensureSignupGrant(client, "u1", { source: "sso_token" }, { enabled: "1" }), { granted: false, skipped: "already_granted" });
  assert.equal(calls.some((c) => c.kind === "getUserById" || c.kind.startsWith("rpc:")), false);
});

test("ensureSignupGrant: ineligible users never reach the RPC", async () => {
  for (const [user, reason] of [
    [{ ...eligibleUser, email_confirmed_at: null }, "email_not_confirmed"],
    [{ ...eligibleUser, last_sign_in_at: null }, "no_sign_in"],
    [{ ...eligibleUser, email: "bot@yopmail.com" }, "disposable_email"],
    [null, "no_user"],
  ] as const) {
    const { client, calls } = fakeSupabase({ user: user as Record<string, unknown> | null });
    assert.deepEqual(await ensureSignupGrant(client, "u1", { source: "auth_callback" }, { enabled: "true" }), { granted: false, skipped: reason });
    assert.equal(calls.some((c) => c.kind.startsWith("rpc:")), false, reason);
  }
});

test("ensureSignupGrant: database refusals and failures are reported, never thrown", async () => {
  resetRateLimits();
  let fake = fakeSupabase({ user: eligibleUser, rpc: { data: { granted: false, reason: "email_already_granted" } } });
  assert.deepEqual(await ensureSignupGrant(fake.client, "u1", { source: "auth_callback" }, { enabled: "true" }), { granted: false, skipped: "email_already_granted" });
  fake = fakeSupabase({ user: eligibleUser, rpc: { error: { code: "WA409" } } });
  assert.deepEqual(await ensureSignupGrant(fake.client, "u1", { source: "auth_callback" }, { enabled: "true" }), { granted: false, skipped: "rpc_failed" });
  fake = fakeSupabase({ user: eligibleUser, throwOn: "lookup" });
  assert.deepEqual(await ensureSignupGrant(fake.client, "u1", { source: "auth_callback" }, { enabled: "true" }), { granted: false, skipped: "error" });
  assert.deepEqual(await ensureSignupGrant(null, "u1", { source: "auth_callback" }, { enabled: "true" }), { granted: false, skipped: "not_configured" });
});

// ---------------------------------------------------------------- marketplace: bonus stays bonus

test("payout split: proportional to the hold's funding, paid rounded down, never more paid than was held", () => {
  assert.deepEqual(payoutSplit(950, 1000, 0), { paid: 950, bonus: 0 });   // all paid: unchanged behaviour
  assert.deepEqual(payoutSplit(950, 0, 1000), { paid: 0, bonus: 950 });   // the welcome grant: all bonus
  assert.deepEqual(payoutSplit(950, 700, 300), { paid: 665, bonus: 285 }); // mixed: 70% / 30%
  assert.deepEqual(payoutSplit(96, 100, 1), { paid: 95, bonus: 1 });       // 95.05 → 95; remainder to bonus
  assert.deepEqual(payoutSplit(10, 5, 5), { paid: 5, bonus: 5 });
  for (const [payout, paid, bonus] of [[9, 3, 7], [99_999, 12_345, 87_655], [1, 1, 1], [500, 499, 1]]) {
    const out = payoutSplit(payout, paid, bonus);
    assert.equal(out.paid + out.bonus, payout);
    assert.ok(out.paid <= paid && out.paid >= 0 && out.bonus >= 0);
  }
  assert.throws(() => payoutSplit(0, 1, 1), RangeError);
  assert.throws(() => payoutSplit(3, 1, 1), RangeError);
  assert.throws(() => payoutSplit(1.5, 1, 1), RangeError);
  assert.equal(PAYOUT_RULE, "proportional_paid_floor_v1");
});

test("SQL payout uses the same rule as payoutSplit", () => {
  assert.match(migration, /v_paid := \(p_payout \* v_from_paid\) \/ v_total;/);
  assert.match(migration, /v_bonus := p_payout - v_paid;/);
});

function payoutFake(opts: { rpcError?: string | null; rpcData?: unknown; holdEntries?: { bucket: string; amount: number }[] }) {
  const calls: Call[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: `rpc:${name}`, args });
      if (name === "settle_marketplace_payout") return { data: opts.rpcData ?? null, error: opts.rpcError ? { code: opts.rpcError } : null };
      return { data: "legacy-tx", error: null };
    },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, in: async () => ({ data: opts.holdEntries ?? [], error: null }) };
      return chain;
    },
  };
  return { client: client as never, calls };
}

const payoutArgs = { reservationId: "r1", sellerId: "s1", payout: 950, description: "d · payout", externalId: "k:payout", app: "ominix", actor: "key:ominix" };

test("settlePayout: uses settle_marketplace_payout and reports the paid/bonus mix", async () => {
  const { client, calls } = payoutFake({ rpcData: { transaction_id: "t9", paid: 665, bonus: 285 } });
  assert.deepEqual(await settlePayout(client, payoutArgs), { transactionId: "t9", paid: 665, bonus: 285 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, {
    p_reservation_id: "r1", p_seller_id: "s1", p_payout: 950, p_description: "d · payout", p_external_id: "k:payout", p_app_slug: "ominix", p_actor: "key:ominix",
  });
});

test("settlePayout before migration 013: all-paid holds fall back to credit_xp paid; bonus holds stay pending", async () => {
  let fake = payoutFake({ rpcError: "PGRST202", holdEntries: [{ bucket: "paid", amount: -1000 }] });
  assert.deepEqual(await settlePayout(fake.client, payoutArgs), { transactionId: "legacy-tx", paid: 950, bonus: 0 });
  assert.equal(fake.calls[1].kind, "rpc:credit_xp");
  fake = payoutFake({ rpcError: "PGRST202", holdEntries: [{ bucket: "bonus", amount: -300 }, { bucket: "paid", amount: -700 }] });
  assert.deepEqual(await settlePayout(fake.client, payoutArgs), { error: "bonus_payout_needs_migration_013" });
  assert.equal(fake.calls.some((c) => c.kind === "rpc:credit_xp"), false);
  fake = payoutFake({ rpcError: "WA409" });
  assert.deepEqual(await settlePayout(fake.client, payoutArgs), { error: "WA409" });
  assert.equal(fake.calls.some((c) => c.kind === "rpc:credit_xp"), false);
});
