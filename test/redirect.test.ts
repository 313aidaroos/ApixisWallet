import { test } from "node:test";
import assert from "node:assert/strict";
import { safeLocalRedirect } from "../sdk/apixis-redirect";

test("login redirects reject executable, external, encoded and normalized host tricks", () => {
  for (const value of [null, undefined, "", "https://evil.test", "javascript:alert(1)", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2fevil.test", "/%252fevil.test", "/a/..//evil.test", "/\nevil.test", "/%00evil.test", "/%zz"]) {
    assert.equal(safeLocalRedirect(value), "/", String(value));
  }
});
test("local board, billing, invite and anchor destinations survive login", () => {
  for (const value of ["/dashboard", "/dashboard?board=Cixy%20Studio", "/dashboard?billing=renew&invite=abc", "/pricing#plans", "/dashboard?return=https%3A%2F%2Frenoxis.dev"]) {
    assert.equal(safeLocalRedirect(value), value);
  }
  assert.equal(safeLocalRedirect("//evil.test", "/dashboard"), "/dashboard");
});
