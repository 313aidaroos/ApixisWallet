import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FEED_CLIENTS, ownerForCaller, ownerLinkAudit } from "../lib/api/caller-owner";
import type { ServiceCaller } from "../lib/api/service-auth";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

/** Minimal read-only Supabase stand-in: select / eq / in / limit / maybeSingle over in-memory rows. */
function fakeSupabase(db: Db) {
  const writes: string[] = [];
  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let max = Infinity;
    const run = () => ({ data: (db[table] ?? []).filter((row) => filters.every((f) => f(row))).slice(0, max), error: null });
    const q = {
      select: () => q,
      eq: (col: string, value: unknown) => (filters.push((row) => row[col] === value), q),
      in: (col: string, values: unknown[]) => (filters.push((row) => values.includes(row[col])), q),
      limit: (n: number) => ((max = n), q),
      maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      insert: () => (writes.push(`insert:${table}`), q),
      upsert: () => (writes.push(`upsert:${table}`), q),
      update: () => (writes.push(`update:${table}`), q),
    };
    return q;
  };
  return { client: { from } as unknown as Parameters<typeof ownerForCaller>[0], writes };
}

const IDS = { apixis: "a0000000-0000-4000-8000-000000000001", socixis: "a0000000-0000-4000-8000-000000000002", renoxis: "a0000000-0000-4000-8000-000000000003", retired: "a0000000-0000-4000-8000-000000000004" };
const USER_SOCIXIS = "11111111-1111-4111-8111-111111111111";
const USER_NOWHERE = "22222222-2222-4222-8222-222222222222";
const USER_APIXIS = "33333333-3333-4333-8333-333333333333";
const USER_RETIRED = "44444444-4444-4444-8444-444444444444";

const db: Db = {
  wallet_api_clients: [
    { id: IDS.apixis, name: "apixis", active: true },
    { id: IDS.socixis, name: "socixis", active: true },
    { id: IDS.renoxis, name: "renoxis", active: true },
    { id: IDS.retired, name: "oldsite", active: false },
  ],
  sso_links: [
    { client_id: IDS.socixis, user_id: USER_SOCIXIS },
    { client_id: IDS.apixis, user_id: USER_APIXIS },
    { client_id: IDS.retired, user_id: USER_RETIRED },
  ],
};

const caller = (name: string, extra: Partial<ServiceCaller> = {}): ServiceCaller => ({
  actor: `key:${name}`,
  apps: [name],
  legacy: false,
  clientId: IDS[name as keyof typeof IDS],
  clientName: name,
  requireSso: false,
  ...extra,
});

describe("feed Apixis ID owners (marketplace only, FEED_CLIENTS only)", () => {
  it("allowlist is exactly ['apixis']", () => {
    assert.deepEqual([...FEED_CLIENTS], ["apixis"]);
  });

  it("apixis + marketplace: linked via another family client → allowed, audited as cross-site", async () => {
    const { client, writes } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: USER_SOCIXIS }, { create: true, marketplace: true });
    assert.deepEqual(r, { ownerId: USER_SOCIXIS, link: { via: "cross_site", feed_client: "apixis", linked_client: "socixis" } });
    assert.deepEqual(ownerLinkAudit(r, "buyer"), { buyer_link: { cross_site: true, feed_client: "apixis", linked_client: "socixis" } });
    assert.deepEqual(writes, [], "never writes (no sso_links row is created)");
  });

  it("apixis + marketplace: own apixis link → allowed, no cross-site audit", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: USER_APIXIS }, { create: true, marketplace: true });
    assert.deepEqual(r, { ownerId: USER_APIXIS });
    assert.deepEqual(ownerLinkAudit(r, "seller"), {});
  });

  it("apixis + marketplace: not linked anywhere (or unknown user) → 403 apixis_id_not_linked", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: USER_NOWHERE }, { create: true, marketplace: true });
    assert.ok("error" in r && r.status === 403 && r.code === "apixis_id_not_linked");
  });

  it("apixis + marketplace: linked only to a retired (inactive) client → 403", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: USER_RETIRED }, { create: true, marketplace: true });
    assert.ok("error" in r && r.status === 403 && r.code === "apixis_id_not_linked");
  });

  it("apixis + marketplace: non-UUID still 400", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: "not-a-uuid" }, { create: true, marketplace: true });
    assert.ok("error" in r && r.status === 400);
  });

  it("non-apixis client on marketplace: unchanged (own-site link only)", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("renoxis"), { ownerId: USER_SOCIXIS }, { create: true, marketplace: true });
    assert.deepEqual(r, { error: "This person has not signed in to your site with Apixis ID", status: 403 });
  });

  it("a key named apixis but scoped as legacy/no client id gets no feed path", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis", { clientId: null }), { ownerId: USER_SOCIXIS }, { create: true, marketplace: true });
    assert.deepEqual(r, { error: "Forbidden", status: 403 });
  });

  it("apixis on a non-marketplace call (balance / redeem / reserve): unchanged", async () => {
    const { client } = fakeSupabase(db);
    const r = await ownerForCaller(client, caller("apixis"), { ownerId: USER_SOCIXIS }, { create: false });
    assert.deepEqual(r, { error: "This person has not signed in to your site with Apixis ID", status: 403 });
  });

  it("legacy key path unchanged", async () => {
    const { client } = fakeSupabase(db);
    const legacy: ServiceCaller = { actor: "legacy-service-key", apps: null, legacy: true, clientId: null, clientName: null, requireSso: false };
    assert.deepEqual(await ownerForCaller(client, legacy, { ownerId: USER_NOWHERE }, { create: false, marketplace: true }), { ownerId: USER_NOWHERE });
  });

  it("only the two marketplace order routes opt in to `marketplace: true`", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts")) files.push(path);
      }
    };
    walk("app");
    const optedIn = files.filter((f) => /marketplace:\s*true\s*}/.test(readFileSync(f, "utf8")) && readFileSync(f, "utf8").includes("ownerForCaller")).sort();
    assert.deepEqual(optedIn, [join("app/api/v1/marketplace/orders/[id]/settle/route.ts"), join("app/api/v1/marketplace/orders/route.ts")]);
  });
});
