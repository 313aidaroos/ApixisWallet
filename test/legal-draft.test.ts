import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LEGAL_DRAFT_BANNER } from "../lib/legal";

test("legal pages are marked draft and do not bump TERMS_VERSION", () => {
  assert.match(LEGAL_DRAFT_BANNER, /DRAFT/);
  assert.match(LEGAL_DRAFT_BANNER, /pending counsel/);
  for (const page of ["app/terms/page.tsx", "app/privacy/page.tsx", "app/refund/page.tsx"]) {
    const source = readFileSync(page, "utf8");
    assert.match(source, /LegalDraft/);
    assert.doesNotMatch(source, /TERMS_VERSION/);
  }
  const refund = readFileSync("app/refund/page.tsx", "utf8");
  assert.match(refund, /All Ixis sales are final/);
  assert.match(refund, /cannot be withdrawn/);
});
