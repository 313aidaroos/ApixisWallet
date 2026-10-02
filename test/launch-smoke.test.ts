import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStartRedirect } from "../scripts/launch/smoke";

const wallet = "https://apixis-wallet.vercel.app/sso/authorize";

describe("launch smoke: Apixis ID hand-off check", () => {
  it("passes a redirect to the Wallet with the right client and an https callback", () => {
    const loc = `${wallet}?client_id=ominix&redirect_uri=${encodeURIComponent("https://ominix-app.vercel.app/auth/apixis/callback")}&state=x`;
    assert.equal(checkStartRedirect("ominix", "ominix-app.vercel.app", 307, loc).ok, true);
  });
  it("fails a page that does not redirect", () => {
    assert.equal(checkStartRedirect("ominix", "ominix-app.vercel.app", 200, null).ok, false);
  });
  it("fails the wrong client or a non-Wallet host", () => {
    assert.equal(checkStartRedirect("ominix", "d", 302, `${wallet}?client_id=socixis&redirect_uri=https%3A%2F%2Fa`).ok, false);
    assert.equal(checkStartRedirect("ominix", "d", 302, "https://evil.example/sso/authorize?client_id=ominix").ok, false);
  });
});
