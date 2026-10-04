import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/api/rate-limit";

/**
 * Apixis ID welcome grant (migration 013, 2026-10-04, Grok — hub decisions under Awad's locks).
 *
 * Every Apixis ID gets 1,000 free Ixis ONCE, in the shared Wallet's BONUS bucket, on the first
 * confirmed sign-in after the grant is switched on. "Lazy backfill": people who signed up earlier
 * and never got one get it on their next sign-in; there is no cutoff date. One per Apixis ID is
 * enforced by the database (signup_grants primary key + unique email + unique ledger key), so the
 * three call sites below can all fire for the same person without double-granting.
 *
 * Call sites: /auth/callback (magic link / email confirmation), the password `login` action, and
 * POST /api/sso/token (a product exchanging an Apixis ID code; covers people with a live Wallet
 * session who never re-enter a password).
 *
 * KILL SWITCH: SIGNUP_GRANT_ENABLED. OFF unless it is exactly one of 1/true/on/yes. Unset = OFF.
 * The hub turns it on at the same moment Apixis.dev's in-world starter goes to 0 (else people get
 * 1,000 in the world AND 1,000 here). Never set it from a PR.
 *
 * Never throws and never blocks a sign-in: every failure is logged and reported as `skipped`.
 */

/** Mirror of the SQL constant in grant_signup_xp (display only; the database decides the amount). */
export const SIGNUP_GRANT_IXIS = 1000;
/** Mirror of the ledger description written by grant_signup_xp. */
export const SIGNUP_GRANT_DESCRIPTION = "Welcome grant · 1,000 free Ixis for your Apixis ID";
export const SIGNUP_GRANT_ENV = "SIGNUP_GRANT_ENABLED";

export type SignupGrantSource = "auth_callback" | "password_login" | "sso_token";

export function signupGrantEnabled(raw: string | undefined | null = process.env[SIGNUP_GRANT_ENV]): boolean {
  return ["1", "true", "on", "yes"].includes((raw ?? "").trim().toLowerCase());
}

/**
 * Throwaway-inbox domains. Not exhaustive on purpose: the real gates are a confirmed email, a real
 * sign-in, one grant per address, and the rate limits below. Extend with SIGNUP_GRANT_BLOCKED_DOMAINS
 * (comma-separated) without a deploy of this list.
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmailo.com",
  "tempr.email", "throwawaymail.com", "trashmail.com", "trashmail.de", "yopmail.com", "yopmail.fr", "yopmail.net",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com",
  "fakeinbox.com", "emailondeck.com", "spamgourmet.com", "mailcatch.com", "moakt.com", "tmail.ws", "tmpmail.org",
  "tmpmail.net", "burnermail.io", "inboxkitten.com", "1secmail.com", "1secmail.net", "1secmail.org",
  "mail.tm", "mail.gw", "dropmail.me", "emailfake.com", "fakemail.net", "spambox.us", "mytemp.email",
  "uberip.com", "minuteinbox.com", "discard.email", "mailpoof.com", "33mail.com", "anonaddy.me",
]);

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string, extraRaw: string | undefined = process.env.SIGNUP_GRANT_BLOCKED_DOMAINS): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  const extra = (extraRaw ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const blocked = (d: string) => DISPOSABLE_DOMAINS.has(d) || extra.includes(d);
  // Subdomains of a blocked domain are blocked too (x.mailinator.com).
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i += 1) if (blocked(parts.slice(i).join("."))) return true;
  return false;
}

export type GrantUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
};

export type Eligibility = { ok: true; email: string } | { ok: false; reason: string };

/** Cheap pre-checks before touching the database. The SQL function re-checks confirmed + signed in. */
export function signupGrantEligibility(user: GrantUser | null | undefined, now = Date.now()): Eligibility {
  if (!user?.id) return { ok: false, reason: "no_user" };
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "no_email" };
  if (!user.email_confirmed_at) return { ok: false, reason: "email_not_confirmed" };
  if (!user.last_sign_in_at) return { ok: false, reason: "no_sign_in" };
  if (user.banned_until && Date.parse(user.banned_until) > now) return { ok: false, reason: "banned" };
  if (isDisposableEmail(email)) return { ok: false, reason: "disposable_email" };
  return { ok: true, email };
}

/** Per serverless instance (see lib/api/rate-limit.ts). Generous for real people, tight for farms. */
export const GRANT_LIMITS = {
  /** New grants from one client IP per hour. */
  ip: { limit: 5, windowMs: 3_600_000 },
  /** New grants for one email domain per hour (a custom domain minting addresses). */
  domain: { limit: 25, windowMs: 3_600_000 },
  /** Common webmail is shared by millions; only the global cap applies to it. */
  global: { limit: 500, windowMs: 3_600_000 },
} as const;

const SHARED_WEBMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com",
  "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "zoho.com", "yandex.com",
]);

export function grantRateLimited(email: string, ip: string | null, now = Date.now()): string | null {
  if (!rateLimit("signup-grant:global", GRANT_LIMITS.global.limit, GRANT_LIMITS.global.windowMs, now).ok) return "rate_limited_global";
  if (ip && !rateLimit(`signup-grant:ip:${ip}`, GRANT_LIMITS.ip.limit, GRANT_LIMITS.ip.windowMs, now).ok) return "rate_limited_ip";
  const domain = emailDomain(email);
  if (!SHARED_WEBMAIL.has(domain) && !rateLimit(`signup-grant:domain:${domain}`, GRANT_LIMITS.domain.limit, GRANT_LIMITS.domain.windowMs, now).ok) {
    return "rate_limited_domain";
  }
  return null;
}

export type SignupGrantResult =
  | { granted: true; transactionId: string; amount: number }
  | { granted: false; skipped: string };

export type SignupGrantContext = { source: SignupGrantSource; ip?: string | null; userAgent?: string | null; actor?: string | null };

/**
 * Grant the welcome Ixis if this person has none yet. Loads the user from the Admin API (authoritative
 * email_confirmed_at / last_sign_in_at), so callers only pass the id.
 */
export async function ensureSignupGrant(
  supabase: SupabaseClient | null,
  userId: string | null | undefined,
  context: SignupGrantContext,
  env: { enabled?: string | null } = {},
): Promise<SignupGrantResult> {
  if (!signupGrantEnabled(env.enabled === undefined ? process.env[SIGNUP_GRANT_ENV] : env.enabled)) return { granted: false, skipped: "disabled" };
  if (!supabase || !userId) return { granted: false, skipped: "not_configured" };
  try {
    // Already granted: stop before spending any rate-limit budget.
    const existing = await supabase.from("signup_grants").select("owner_id").eq("owner_id", userId).maybeSingle();
    if (existing.error) {
      console.error("signup grant lookup failed", { code: existing.error.code });
      return { granted: false, skipped: "lookup_failed" };
    }
    if (existing.data) return { granted: false, skipped: "already_granted" };

    const { data: loaded, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !loaded?.user) return { granted: false, skipped: "no_user" };
    const user = loaded.user as GrantUser;
    const eligible = signupGrantEligibility(user);
    if (!eligible.ok) return { granted: false, skipped: eligible.reason };

    const ip = context.ip?.trim() || null;
    const limited = grantRateLimited(eligible.email, ip);
    if (limited) {
      console.warn("signup grant rate limited", { reason: limited, source: context.source });
      return { granted: false, skipped: limited };
    }

    const { data, error } = await supabase.rpc("grant_signup_xp", {
      p_owner_id: userId,
      p_source: context.source,
      p_actor: context.actor ?? `signup-grant:${context.source}`,
      p_ip: ip,
      p_user_agent: context.userAgent ?? null,
    });
    if (error) {
      console.error("signup grant failed", { code: error.code, source: context.source });
      return { granted: false, skipped: "rpc_failed" };
    }
    const result = (data ?? {}) as { granted?: boolean; reason?: string; transaction_id?: string; amount?: number };
    if (result.granted && result.transaction_id) {
      return { granted: true, transactionId: result.transaction_id, amount: Number(result.amount ?? SIGNUP_GRANT_IXIS) };
    }
    return { granted: false, skipped: result.reason ?? "not_granted" };
  } catch (err) {
    console.error("signup grant error", { message: err instanceof Error ? err.message : "unknown", source: context.source });
    return { granted: false, skipped: "error" };
  }
}

/** Client IP and user agent from request headers (Vercel: first x-forwarded-for hop is the client). */
export function clientContext(headers: Headers): { ip: string | null; userAgent: string | null } {
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  return { ip: ip ? ip.slice(0, 64) : null, userAgent: (headers.get("user-agent") ?? "").slice(0, 400) || null };
}
