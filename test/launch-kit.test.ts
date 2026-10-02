import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMPANIES } from "../scripts/launch/companies";
import { Supabase, Vercel, run } from "../scripts/launch/kit";
import { generateSecret, mergeWorldKeys, parseKeysFile, pickProject, planCompany } from "../scripts/launch/plan";

const company = (id: string) => COMPANIES.find((c) => c.id === id)!;
const noKeys = parseKeysFile("");

describe("launch kit: keys file", () => {
  it("reads shared keys, company sections and quotes; ignores comments and empty values", () => {
    const k = parseKeysFile(`# comment
VERCEL_TOKEN=tok
ANTHROPIC_API_KEY="sk-ant-x"
RESEND_API_KEY=
[socixis]
META_APP_ID=123
[vercel]
contraxis=contraxis-dev
`);
    assert.equal(k.shared.VERCEL_TOKEN, "tok");
    assert.equal(k.shared.ANTHROPIC_API_KEY, "sk-ant-x");
    assert.equal(k.shared.RESEND_API_KEY, undefined);
    assert.equal(k.sections.socixis.META_APP_ID, "123");
    assert.deepEqual(k.sections.vercel, {});
  });
});

describe("launch kit: plan", () => {
  it("never replaces a value that exists (or its stand-in)", () => {
    const keys = parseKeysFile("ANTHROPIC_API_KEY=a\nRESEND_API_KEY=r\n");
    const plan = planCompany(
      company("deduxis"),
      new Set(["ANTHROPIC_API_KEY", "APIXIS_WALLET_API_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]),
      keys,
      { supabase: { url: "https://x.supabase.co", anon: "anon", service: "svc" }, walletKey: "apx_live_x", worldKey: "w" },
    );
    const names = plan.map((p) => p.name);
    assert.ok(!names.includes("ANTHROPIC_API_KEY"));
    assert.ok(!names.includes("WALLET_API_KEY"), "APIXIS_WALLET_API_KEY stands in for WALLET_API_KEY");
    assert.ok(!names.includes("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SECRET_KEY stands in");
    assert.ok(!names.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "publishable key stands in");
    assert.ok(names.includes("RESEND_API_KEY"));
    assert.ok(names.includes("NEXT_PUBLIC_SUPABASE_URL"));
    assert.ok(names.includes("APIXIS_WORLD_KEY"));
    assert.equal(plan.find((p) => p.name === "APIXIS_CLIENT_ID")?.value, "deduxis");
  });

  it("generates secrets in the format each site checks", () => {
    assert.match(generateSecret("hex32"), /^[0-9a-f]{64}$/);
    assert.equal(Buffer.from(generateSecret("b64-32"), "base64").length, 32);
    const reno = planCompany(company("renoxis"), new Set(), noKeys);
    assert.match(reno.find((p) => p.name === "CONNECTION_ENCRYPTION_KEY")!.value, /^[0-9a-f]{64}$/);
    const soc = planCompany(company("socixis"), new Set(), noKeys);
    assert.equal(Buffer.from(soc.find((p) => p.name === "TOKEN_ENC_KEY")!.value, "base64").length, 32);
  });

  it("does not generate a secret that would replace one Apixis.dev already uses", () => {
    const plan = planCompany(company("apixis"), new Set(["LAUNCH_SECRET", "ADMIN_SECRET"]), noKeys);
    const names = plan.map((p) => p.name);
    assert.ok(!names.includes("CITIZEN_TOKEN_SECRET"));
    assert.ok(!names.includes("LAUNCH_ADMIN_KEY"));
    assert.ok(!names.includes("LAUNCH_SECRET"), "LAUNCH_SECRET is never generated");
  });

  it("sets PCB_DURABLE_JOBS only once the hub columns exist", () => {
    assert.ok(!planCompany(company("contentbot"), new Set(), noKeys).some((p) => p.name === "PCB_DURABLE_JOBS"));
    assert.ok(planCompany(company("contentbot"), new Set(), noKeys, { durableJobsReady: true }).some((p) => p.name === "PCB_DURABLE_JOBS"));
  });

  it("finds the Vercel project by repo, ignores temporary-* duplicates, flags real ambiguity", () => {
    const projects = [
      { id: "1", name: "contraxis-dev", repo: "contraxis.dev" },
      { id: "2", name: "temporary-turbo-sienna-p6yqsjd", repo: "contraxis.dev" },
      { id: "3", name: "socixis", repo: "Socixis" },
      { id: "4", name: "socixis-old", repo: "socixis" },
    ];
    assert.equal(pickProject(company("contraxis"), projects).project?.name, "contraxis-dev");
    assert.match(pickProject(company("socixis"), projects).problem ?? "", /several/);
    assert.equal(pickProject(company("socixis"), projects, "socixis").project?.id, "3");
    assert.match(pickProject(company("lyrixis"), projects).problem ?? "", /no Vercel project/);
  });

  it("merges world-key hashes, replacing only the clients that got new keys", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    const c = "c".repeat(64);
    assert.equal(mergeWorldKeys(`renoxis:${a},socixis:${b},junk`, { socixis: c, ominix: a }), `renoxis:${a},socixis:${c},ominix:${a}`);
  });
});

// ------------------------------------------------------------------ end-to-end with fake APIs
type Call = { method: string; url: string; body?: unknown };

function fakeWorld(opts: { activeClients?: string[]; deduxisUrl?: string; refuse?: string } = {}) {
  const calls: Call[] = [];
  const env: Record<string, { id: string; key: string; type: string; target: string[]; value: string }[]> = {
    p_apixis: [{ id: "e1", key: "APIXIS_WORLD_KEYS", type: "encrypted", target: ["production"], value: `renoxis:${"a".repeat(64)}` }],
    p_deduxis: [
      { id: "e2", key: "NEXT_PUBLIC_SUPABASE_URL", type: "plain", target: ["production"], value: opts.deduxisUrl ?? "https://uxgtppwqonbznuoyebbb.supabase.co" },
    ],
    p_ominix: [],
    p_renoxis: [{ id: "e3", key: "WALLET_API_KEY", type: "sensitive", target: ["production"], value: "" }],
  };
  const projects = [
    { id: "p_apixis", name: "apixis-dev", link: { repo: "apixis.dev" } },
    { id: "p_deduxis", name: "deduxis", link: { repo: "Deduxis" } },
    { id: "p_ominix", name: "ominix", link: { repo: "Ominix" } },
    { id: "p_renoxis", name: "renoxis", link: { repo: "renoxis.dev" } },
  ];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url: url.pathname + url.search, body });
    const p = url.pathname;
    if (url.host === "api.vercel.com") {
      if (p === "/v2/teams") return json({ teams: [] });
      if (p === "/v10/projects") return json({ projects, pagination: { next: null } });
      let m = p.match(/^\/v10\/projects\/([^/]+)\/env$/);
      if (m && method === "GET") return json({ envs: (env[m[1]] ?? []).map((e) => ({ id: e.id, key: e.key, type: e.type, target: e.target })) });
      if (m && method === "POST") {
        if (body.key === opts.refuse) return json({ error: { message: "nope" } }, 500);
        (env[m[1]] ??= []).push({ id: `n${calls.length}`, key: body.key, type: body.type, target: body.target, value: body.value });
        return json({ created: true });
      }
      m = p.match(/^\/v1\/projects\/([^/]+)\/env\/([^/]+)$/);
      if (m) return json({ value: env[m[1]]?.find((e) => e.id === m![2])?.value });
      if (p === "/v6/deployments") return json({ deployments: [{ uid: "dpl_1" }] });
      if (p === "/v13/deployments") return json({ id: "dpl_2" });
    }
    if (url.host === "api.supabase.com") {
      if (p.endsWith("/api-keys"))
        return json([
          { name: "anon", api_key: "anon-jwt" },
          { name: "service_role", api_key: "service-jwt" },
        ]);
      if (p.endsWith("/config/auth")) return json({ ok: true });
      if (p.endsWith("/database/query")) {
        const q = String(body.query);
        if (q.includes("from public.wallet_api_clients")) {
          const name = q.match(/name = '([^']+)'/)?.[1] ?? "";
          return json([{ n: (opts.activeClients ?? []).includes(name) ? 1 : 0 }]);
        }
        if (q.includes("information_schema.columns")) return json([{ n: 0 }]);
        return json([]);
      }
    }
    return json({ error: { message: "unexpected " + p } }, 404);
  }) as typeof fetch;
  return { f, calls, env };
}

async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}

const KEYS = parseKeysFile("ANTHROPIC_API_KEY=sk-ant-SECRET-VALUE\nRESEND_API_KEY=re_SECRET\n");

describe("launch kit: end to end (fake Vercel + Supabase)", () => {
  it("check mode changes nothing", async () => {
    const w = fakeWorld();
    await quietly(() => run({ mode: "check", dryRun: false, keys: KEYS, vercel: new Vercel("t", undefined, w.f), vercelOverrides: {} }));
    assert.ok(w.calls.every((c) => c.method === "GET"));
  });

  it("dry run writes nothing anywhere", async () => {
    const w = fakeWorld();
    await quietly(() =>
      run({ mode: "apply", dryRun: true, keys: KEYS, vercel: new Vercel("t", undefined, w.f), supabase: new Supabase("s", w.f), vercelOverrides: {} }),
    );
    const writes = w.calls.filter((c) => c.method !== "GET" && !String(c.body && (c.body as { query?: string }).query).startsWith("select"));
    assert.deepEqual(writes, []);
  });

  it("apply: sets keys, mints a Wallet key only for a site with none, registers world keys, never prints secrets", async () => {
    const w = fakeWorld({ activeClients: ["deduxis", "apixis"] });
    const lines = await quietly(() =>
      run({ mode: "apply", dryRun: false, keys: KEYS, vercel: new Vercel("t", undefined, w.f), supabase: new Supabase("s", w.f), vercelOverrides: {} }),
    );
    const out = lines.join("\n");
    for (const secret of ["sk-ant-SECRET-VALUE", "re_SECRET", "anon-jwt", "service-jwt", "apx_live_"]) assert.ok(!out.includes(secret), `printed ${secret}`);

    const names = (pid: string) => w.env[pid].map((e) => e.key);
    // Ominix: no Wallet client in the DB → minted and stored; Supabase keys filled.
    assert.ok(names("p_ominix").includes("WALLET_API_KEY"));
    assert.match(w.env.p_ominix.find((e) => e.key === "WALLET_API_KEY")!.value, /^apx_live_/);
    assert.ok(names("p_ominix").includes("SUPABASE_SERVICE_ROLE_KEY"));
    const inserts = w.calls.filter((c) => String((c.body as { query?: string })?.query ?? "").startsWith("insert into public.wallet_api_clients"));
    assert.equal(inserts.length, 1, "exactly one Wallet client registered");
    assert.match(String((inserts[0].body as { query: string }).query), /'ominix'.*ominix-app\.vercel\.app\/auth\/apixis\/callback/);
    // Deduxis already has an active client in the DB but no key in Vercel → nothing minted.
    assert.ok(!names("p_deduxis").includes("WALLET_API_KEY"));
    assert.match(out, /Deduxis: already has a Wallet key/);
    // Renoxis already has a (sensitive) WALLET_API_KEY → untouched, no duplicate.
    assert.equal(names("p_renoxis").filter((n) => n === "WALLET_API_KEY").length, 1);
    // World keys: new ones for deduxis + ominix (renoxis had none either → also new); hashes merged on Apixis.dev.
    const world = w.env.p_apixis.filter((e) => e.key === "APIXIS_WORLD_KEYS").at(-1)!.value;
    assert.match(world, /deduxis:[0-9a-f]{64}/);
    assert.match(world, /ominix:[0-9a-f]{64}/);
    assert.ok(names("p_ominix").includes("APIXIS_WORLD_KEY"));
    // Redeploys only the projects that changed.
    assert.ok(w.calls.some((c) => c.url.startsWith("/v13/deployments")));
  });

  it("refuses to add Supabase keys when the site's Supabase URL points at another project", async () => {
    const w = fakeWorld({ deduxisUrl: "https://someotherproject.supabase.co" });
    const lines = await quietly(() =>
      run({ mode: "apply", dryRun: false, keys: KEYS, vercel: new Vercel("t", undefined, w.f), supabase: new Supabase("s", w.f), vercelOverrides: {} }),
    );
    assert.ok(!w.env.p_deduxis.some((e) => e.key === "SUPABASE_SERVICE_ROLE_KEY"));
    assert.match(lines.join("\n"), /Deduxis: NEXT_PUBLIC_SUPABASE_URL is set to a different/);
  });

  it("switches a new Wallet key off again when Vercel refuses to store it", async () => {
    const w = fakeWorld({ activeClients: ["deduxis", "apixis"], refuse: "WALLET_API_KEY" });
    await quietly(() =>
      run({ mode: "apply", dryRun: false, keys: KEYS, vercel: new Vercel("t", undefined, w.f), supabase: new Supabase("s", w.f), vercelOverrides: {} }),
    );
    const sql = w.calls.map((c) => String((c.body as { query?: string })?.query ?? ""));
    const insert = sql.find((q) => q.startsWith("insert into public.wallet_api_clients"))!;
    const hash = insert.match(/'([0-9a-f]{64})'/)![1];
    assert.ok(sql.some((q) => q.startsWith("update public.wallet_api_clients set active = false") && q.includes(hash)));
  });
});
