import { createHash, randomBytes } from "node:crypto";

/**
 * Apixis ID (migration 009): the Wallet is the family's login.
 *
 *   site → GET  /sso/authorize?client_id=<site>&redirect_uri=<exact callback>&state=<random>
 *   Wallet (user signed in) → 302 <redirect_uri>?code=<one-time>&state=<same>
 *   site SERVER → POST /api/sso/token { code, redirect_uri }  (Authorization: Bearer <site apx_ key>)
 *                 ← { sub: <Wallet user id>, email, email_verified: true }
 *
 * Codes are random, stored as SHA-256, single use, 2 minutes, bound to the client and redirect_uri.
 */

export const SSO_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SSO_STATE_PATTERN = /^[A-Za-z0-9._~-]{16,200}$/;
export const SSO_CLIENT_PATTERN = /^[a-z0-9][a-z0-9._-]{1,60}$/;

export function newSsoCode() {
  return randomBytes(32).toString("base64url");
}

export function hashSsoCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/** Exact match against the client's registered callbacks. https only (http only for localhost). */
export function redirectUriAllowed(redirectUri: string, registered: readonly string[]) {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return false;
  return registered.includes(redirectUri);
}

export function redirectWithParams(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
