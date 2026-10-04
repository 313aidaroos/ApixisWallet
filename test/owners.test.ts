import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMasterEmail, isMasterUser, masterAccess, ownerEmails, OWNER_EMAILS } from "../lib/owners";

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>) {
  const previous: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(vars)) {
    previous[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const confirmed = (email: string | null) => ({ id: "u1", email, emailConfirmed: true });
const unconfirmed = (email: string | null) => ({ id: "u2", email, emailConfirmed: false });

describe("wallet owners (two masters)", () => {
  it("always includes both owner emails, even with no env", async () => {
    await withEnv({ ALLOWED_EMAIL: undefined, ALLOWED_EMAILS: undefined }, () => {
      assert.deepEqual([...OWNER_EMAILS], ["awad@apixis.dev", "alaidaroosawad@gmail.com"]);
      assert.deepEqual(ownerEmails(), ["awad@apixis.dev", "alaidaroosawad@gmail.com"]);
      assert.ok(isMasterUser(confirmed("awad@apixis.dev")));
      assert.ok(isMasterUser(confirmed("alaidaroosawad@gmail.com")));
    });
  });

  it("matches case-insensitively and trimmed", () => {
    assert.ok(isMasterEmail("  AlaidarooSAWAD@Gmail.COM "));
    assert.ok(isMasterEmail("AWAD@APIXIS.DEV"));
    assert.ok(isMasterUser(confirmed(" Alaidaroosawad@GMAIL.com\t")));
    assert.ok(isMasterUser(confirmed("Awad@Apixis.Dev ")));
  });

  it("denies unverified (unconfirmed) owner emails", () => {
    assert.equal(isMasterUser(unconfirmed("alaidaroosawad@gmail.com")), false);
    assert.equal(isMasterUser(unconfirmed("awad@apixis.dev")), false);
    assert.equal(masterAccess(unconfirmed("alaidaroosawad@gmail.com")), 403);
    // emailConfirmed must be literally true (no truthy strings smuggled in)
    assert.equal(isMasterUser({ email: "awad@apixis.dev", emailConfirmed: "yes" as unknown as boolean }), false);
  });

  it("denies other emails, look-alikes and empty values", () => {
    for (const email of [
      "someone@gmail.com", "awad@apixis.dev.evil.test", "alaidaroosawad@gmail.com.evil", "xalaidaroosawad@gmail.com",
      "awad+1@apixis.dev", "alaidaroos.awad@gmail.com", "", " ", null,
    ]) {
      assert.equal(isMasterUser(confirmed(email)), false, String(email));
      assert.equal(isMasterEmail(email), false, String(email));
    }
    assert.equal(isMasterUser(null), false);
    assert.equal(isMasterUser(undefined), false);
  });

  it("gives 401 with no session, 403 for non-owners, ok for confirmed owners", () => {
    assert.equal(masterAccess(null), 401);
    assert.equal(masterAccess(confirmed("someone@else.test")), 403);
    assert.equal(masterAccess(confirmed("alaidaroosawad@gmail.com")), "ok");
    assert.equal(masterAccess(confirmed("awad@apixis.dev")), "ok");
  });

  it("keeps ALLOWED_EMAIL and adds comma-separated ALLOWED_EMAILS; env can't remove the two", async () => {
    await withEnv({ ALLOWED_EMAIL: " Ops@Apixis.dev ", ALLOWED_EMAILS: "a@b.co, ,C@D.co,not-an-email" }, () => {
      assert.deepEqual(ownerEmails(), ["awad@apixis.dev", "alaidaroosawad@gmail.com", "ops@apixis.dev", "a@b.co", "c@d.co"]);
      assert.ok(isMasterUser(confirmed("ops@apixis.dev")));
      assert.ok(isMasterUser(confirmed("c@d.co")));
      assert.equal(isMasterUser(unconfirmed("c@d.co")), false);
      assert.equal(isMasterEmail("not-an-email"), false);
    });
    await withEnv({ ALLOWED_EMAIL: "someone@else.test", ALLOWED_EMAILS: "" }, () => {
      assert.ok(isMasterUser(confirmed("awad@apixis.dev")));
      assert.ok(isMasterUser(confirmed("alaidaroosawad@gmail.com")));
    });
  });
});
