/**
 * Wallet master / owner accounts.
 * 2026-10-04 (CT) Wallet Lead: Awad's rule — both addresses below are master/owner admins with full
 * control. They are a code constant, so no env change is needed. ALLOWED_EMAIL (single, legacy) and
 * ALLOWED_EMAILS (optional, comma-separated) can ADD owners; they can never remove these two.
 *
 * An email match alone is never access. Use `isMasterUser` with the server-verified Supabase user
 * (`getAuthenticatedUser()` → `auth.getUser()`), which also requires a confirmed email. Never pass
 * an email taken from a form, query string, header or request body.
 */
export const OWNER_EMAILS = ["awad@apixis.dev", "alaidaroosawad@gmail.com"] as const;

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function envList(value: string | undefined): string[] {
  return (value ?? "").split(",").map(normalizeEmail).filter((e) => e.includes("@"));
}

/** Every owner email, lower-cased and trimmed: the two constants + ALLOWED_EMAIL + ALLOWED_EMAILS. Read per call. */
export function ownerEmails(env: Record<string, string | undefined> = process.env): string[] {
  return [...new Set([...OWNER_EMAILS, ...envList(env.ALLOWED_EMAIL), ...envList(env.ALLOWED_EMAILS)])];
}

/** Legacy single "master" address (ALLOWED_EMAIL, else awad@apixis.dev). Kept for older imports. */
export const MASTER_EMAIL = envList(process.env.ALLOWED_EMAIL)[0] ?? OWNER_EMAILS[0];

/**
 * True when the address is on the owner list (case-insensitive, trimmed). An address check only:
 * use it for wording, never to grant access. Access = `isMasterUser`.
 */
export function isMasterEmail(email: string | undefined | null): boolean {
  const e = normalizeEmail(email);
  return e !== "" && ownerEmails().includes(e);
}

export type SessionUser = { id?: string; email: string | null; emailConfirmed: boolean } | null | undefined;

/**
 * Master access gate. Requires a server-verified Supabase session user whose email is CONFIRMED
 * (auth.users.email_confirmed_at set; Supabase sets it on confirmed signup, magic link / OTP and
 * verified OAuth sign-in) AND on the owner list. An unconfirmed signup for an owner address gets nothing.
 */
export function isMasterUser(user: SessionUser): boolean {
  return Boolean(user && user.emailConfirmed === true && isMasterEmail(user.email));
}

/** HTTP outcome for a master-only route: 401 no session, 403 not a confirmed owner, else ok. */
export function masterAccess(user: SessionUser): "ok" | 401 | 403 {
  if (!user) return 401;
  return isMasterUser(user) ? "ok" : 403;
}
