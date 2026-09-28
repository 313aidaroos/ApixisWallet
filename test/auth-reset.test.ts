import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecoveryHash, resetRedirectUrl } from "../lib/auth-reset";

// 2026-09-28 Grok Developer Bot: Forgot password → /set-password?reset=1 with the recovery session in the hash.
const authorize =
  "/sso/authorize?client_id=apixis&redirect_uri=https%3A%2F%2Fapixis.dev%2Fauth%2Fapixis%2Fcallback&state=MeSNcRt18fNkYx5xR9Ff93xDZo3NhrzQ";

test("reset email lands on /set-password?reset=1 and keeps a same-origin next", () => {
  const url = new URL(resetRedirectUrl("https://apixis-wallet.vercel.app/", authorize));
  assert.equal(url.origin, "https://apixis-wallet.vercel.app");
  assert.equal(url.pathname, "/set-password");
  assert.equal(url.searchParams.get("reset"), "1");
  assert.equal(url.searchParams.get("next"), authorize);
});

test("reset redirect refuses off-site next and falls back to the Wallet origin", () => {
  assert.equal(new URL(resetRedirectUrl("https://apixis-wallet.vercel.app", "https://evil.test")).searchParams.get("next"), "/");
  assert.equal(new URL(resetRedirectUrl("", "/")).origin, "https://apixis-wallet.vercel.app");
});

test("recovery hash: session, expired link, nothing", () => {
  assert.deepEqual(parseRecoveryHash("#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=recovery"), {
    kind: "session", accessToken: "at", refreshToken: "rt",
  });
  const expired = parseRecoveryHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  assert.equal(expired.kind, "error");
  assert.match((expired as { message: string }).message, /expired/);
  assert.deepEqual(parseRecoveryHash(""), { kind: "none" });
  assert.deepEqual(parseRecoveryHash("#access_token=only"), { kind: "none" });
});
