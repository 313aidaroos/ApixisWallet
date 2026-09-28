import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backRedirectTarget, buildStatusPayload, returnRedirectTarget, toPublicStatus } from "../lib/checkout/status";

// 2026-09-28 Grok Developer Bot: "Back to <product>" after checkout, even before the credit posts.
const locked = { extraHosts: [] as string[], allowHttpLocalhost: false };
const input = {
  sessionStatus: "complete",
  paymentStatus: "paid",
  credited: false,
  ledgerUnreachable: false,
  pack: { id: "spark", name: "Spark", xp: 1000 },
  returnUrl: "https://socixis.vercel.app/billing",
  destinationApp: "socixis",
};

describe("checkout back link", () => {
  it("offers the allowlisted return_url while the credit is still pending, without auto-redirecting", () => {
    const waiting = buildStatusPayload(input, locked);
    assert.equal(waiting.next, "wait");
    assert.equal(returnRedirectTarget(waiting, locked), null);
    assert.equal(backRedirectTarget(waiting, locked), "https://socixis.vercel.app/billing");
    assert.equal(toPublicStatus(waiting).returnHost, "socixis.vercel.app");
    assert.equal("backUrl" in toPublicStatus(waiting), false);
  });

  it("never offers a foreign or missing return_url", () => {
    assert.equal(backRedirectTarget(buildStatusPayload({ ...input, returnUrl: "https://evil.example/x" }, locked), locked), null);
    assert.equal(backRedirectTarget(buildStatusPayload({ ...input, returnUrl: null }, locked), locked), null);
  });
});
