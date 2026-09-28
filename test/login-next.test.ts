import { test } from "node:test";
import assert from "node:assert/strict";
import { safeLocalRedirect } from "../lib/apixis-redirect";
import { skipSetPassword } from "../lib/auth-next";

// 2026-09-28 Grok Developer Bot: the Apixis ID round trip depends on `next` surviving login.
const authorize =
  "/sso/authorize?client_id=apixis&redirect_uri=https%3A%2F%2Fapixis.dev%2Fauth%2Fapixis%2Fcallback&state=MeSNcRt18fNkYx5xR9Ff93xDZo3NhrzQ";

test("the /sso/authorize next that the Wallet sends to /login survives safeLocalRedirect unchanged", () => {
  assert.equal(safeLocalRedirect(authorize), authorize);
  assert.equal(safeLocalRedirect(decodeURIComponent(encodeURIComponent(authorize))), authorize);
});

test("login next still refuses other origins", () => {
  for (const bad of ["https://evil.test/sso/authorize", "//evil.test", "/\\evil.test"]) {
    assert.equal(safeLocalRedirect(bad), "/");
  }
});

test("magic link skips /set-password once a password exists, keeping the inner next", () => {
  const wrapped = `/set-password?next=${encodeURIComponent(authorize)}`;
  assert.equal(skipSetPassword(wrapped, true), authorize);
  assert.equal(skipSetPassword(wrapped, false), wrapped);
  assert.equal(skipSetPassword("/buy?pack=spark", true), "/buy?pack=spark");
  assert.equal(skipSetPassword(`/set-password?next=${encodeURIComponent("https://evil.test")}`, true), "/");
});
