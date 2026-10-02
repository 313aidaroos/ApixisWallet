/**
 * Apixis launch kit — fill in .env.launch once, then:
 *
 *   npm run launch:check            # read-only: every company, ready or what is missing
 *   npm run launch -- --dry-run     # show what it WOULD set (names only)
 *   npm run launch                  # do it: Supabase setup, Wallet + world keys, Vercel env vars, redeploy
 *
 * Rules: never replaces a value that is already set, never prints a secret, never touches trading.
 * Docs: docs/LAUNCH_KIT.md.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { API_KEY_PATTERN, hashApiKey } from "../../lib/api/service-auth";
import { FAMILY_SITES } from "../family-sites";
import { COMPANIES, HUB_REF, WALLET_REF, supabaseRefs, type Company } from "./companies";
import {
  generateSecret,
  isPresent,
  mergeWorldKeys,
  missingOptional,
  missingRequired,
  parseKeysFile,
  pickProject,
  planCompany,
  sha256Hex,
  whereFrom,
  type Extras,
  type KeysFile,
  type PlannedVar,
  type ProjectRef,
} from "./plan";

type Fetch = typeof fetch;
const log = (...a: unknown[]) => console.log(...a);

// ---------------------------------------------------------------- Vercel
interface EnvRow {
  id: string;
  key: string;
  type: string;
  target?: string[] | string;
}

export class Vercel {
  constructor(
    private token: string,
    private teamIdOverride: string | undefined,
    private f: Fetch = fetch,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}, teamId?: string): Promise<T> {
    const url = new URL(`https://api.vercel.com${path}`);
    if (teamId) url.searchParams.set("teamId", teamId);
    const res = await this.f(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Vercel ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${body?.error?.message ?? ""}`.trim());
    return body;
  }

  /** Every project on the personal account and every team, with the GitHub repo it is linked to. */
  async projects(): Promise<ProjectRef[]> {
    const scopes: (string | undefined)[] = [];
    if (this.teamIdOverride) scopes.push(this.teamIdOverride);
    else {
      scopes.push(undefined);
      const teams = await this.call<{ teams?: { id: string }[] }>("/v2/teams").catch(() => ({ teams: [] }));
      for (const t of teams.teams ?? []) scopes.push(t.id);
    }
    const out: ProjectRef[] = [];
    for (const teamId of scopes) {
      let until: string | undefined;
      for (let page = 0; page < 20; page++) {
        const q = `/v10/projects?limit=100${until ? `&until=${until}` : ""}`;
        const res = await this.call<{ projects: { id: string; name: string; link?: { repo?: string } }[]; pagination?: { next?: number | null } }>(
          q,
          {},
          teamId,
        ).catch((e: Error) => {
          // The first scope proves the token works; a failure there is the owner's to fix, not "no projects".
          if (teamId === scopes[0]) throw new Error(`Vercel refused the token (${e.message}). Check VERCEL_TOKEN (and VERCEL_TEAM_ID) in .env.launch.`);
          return { projects: [], pagination: { next: null } };
        });
        for (const p of res.projects ?? []) if (!out.some((o) => o.id === p.id)) out.push({ id: p.id, name: p.name, repo: p.link?.repo, teamId });
        if (!res.pagination?.next) break;
        until = String(res.pagination.next);
      }
    }
    return out;
  }

  /** Env vars that apply to Production. */
  async env(p: ProjectRef): Promise<EnvRow[]> {
    const res = await this.call<{ envs: EnvRow[] }>(`/v10/projects/${p.id}/env`, {}, p.teamId);
    return (res.envs ?? []).filter((e) => (Array.isArray(e.target) ? e.target : [e.target]).includes("production"));
  }

  /** Decrypted value, or undefined for "sensitive" vars (Vercel never returns those). */
  async value(p: ProjectRef, row: EnvRow): Promise<string | undefined> {
    if (row.type === "sensitive") return undefined;
    const res = await this.call<{ value?: string }>(`/v1/projects/${p.id}/env/${row.id}`, {}, p.teamId).catch(() => ({ value: undefined }));
    return res.value;
  }

  async add(p: ProjectRef, name: string, value: string, upsert = false) {
    const type = name.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
    await this.call(
      `/v10/projects/${p.id}/env${upsert ? "?upsert=true" : ""}`,
      { method: "POST", body: JSON.stringify({ key: name, value, type, target: ["production", "preview"] }) },
      p.teamId,
    );
  }

  /** Rebuild the latest production deployment so new env vars take effect. */
  async redeploy(p: ProjectRef): Promise<string> {
    const list = await this.call<{ deployments: { uid: string }[] }>(
      `/v6/deployments?projectId=${p.id}&target=production&state=READY&limit=1`,
      {},
      p.teamId,
    );
    const last = list.deployments?.[0];
    if (!last) return "no production deployment yet (push to main once)";
    await this.call(`/v13/deployments`, { method: "POST", body: JSON.stringify({ name: p.name, deploymentId: last.uid, target: "production" }) }, p.teamId);
    return "redeploying";
  }
}

// ---------------------------------------------------------------- Supabase Management API
export class Supabase {
  constructor(
    private token: string,
    private f: Fetch = fetch,
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.f(`https://api.supabase.com/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${text.slice(0, 160)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** anon + service_role (legacy JWT keys work with every site's code). */
  async keys(ref: string): Promise<{ url: string; anon?: string; service?: string }> {
    const rows = await this.call<{ name?: string; type?: string; api_key?: string }[]>(`/projects/${ref}/api-keys?reveal=true`);
    const find = (n: string) => rows.find((r) => r.name === n && r.api_key)?.api_key;
    return { url: `https://${ref}.supabase.co`, anon: find("anon"), service: find("service_role") };
  }

  async sql<T = Record<string, unknown>>(ref: string, query: string): Promise<T[]> {
    return this.call<T[]>(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query }) });
  }

  async leakedPasswordProtection(ref: string) {
    await this.call(`/projects/${ref}/config/auth`, { method: "PATCH", body: JSON.stringify({ password_hibp_enabled: true }) });
  }
}

// ---------------------------------------------------------------- helpers
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function repoFile(...parts: string[]): string | undefined {
  // The kit runs from ApixisWallet; sibling repos are checked out next to it on the owner's Mac.
  const p = resolve(process.cwd(), ...parts);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}

export interface RunOptions {
  mode: "check" | "apply";
  dryRun: boolean;
  keys: KeysFile;
  vercel: Vercel;
  supabase?: Supabase;
  vercelOverrides: Record<string, string>;
  /** SQL the kit runs on the hub / Pinixis (read from the sibling repos, or passed in tests). */
  sqlFiles?: { hubLint?: string; pcbDurable?: string; pinixisTrigger?: string };
}

interface CompanyState {
  c: Company;
  project?: ProjectRef;
  problem?: string;
  rows: EnvRow[];
  names: Set<string>;
}

async function loadState(o: RunOptions, projects: ProjectRef[]): Promise<CompanyState[]> {
  const out: CompanyState[] = [];
  for (const c of COMPANIES) {
    const { project, problem } = pickProject(c, projects, o.vercelOverrides[c.id]);
    let rows: EnvRow[] = [];
    let err = problem;
    if (project) rows = await o.vercel.env(project).catch((e: Error) => ((err = e.message), []));
    out.push({ c, project, problem: err, rows, names: new Set(rows.map((r) => r.key)) });
  }
  return out;
}

export function report(states: CompanyState[]): { ready: number; total: number; lines: string[] } {
  const lines: string[] = [];
  let ready = 0;
  for (const s of states) {
    if (!s.project) {
      lines.push(`✗ ${s.c.label}: ${s.problem}`);
      continue;
    }
    const missing = missingRequired(s.c, s.names);
    const optional = missingOptional(s.c, s.names);
    if (!missing.length) ready++;
    lines.push(`${missing.length ? "✗" : "✓"} ${s.c.label} (Vercel: ${s.project.name})${missing.length ? "" : " — ready"}`);
    for (const m of missing) lines.push(`    needs ${whereFrom(s.c, m)}`);
    if (optional.length) lines.push(`    optional, not set: ${optional.join(", ")}`);
  }
  return { ready, total: states.length, lines };
}

/** Runs the whole launch. Returns the lines it would print (also printed). */
export async function run(o: RunOptions): Promise<string[]> {
  const out: string[] = [];
  const say = (s: string) => {
    out.push(s);
    log(s);
  };
  const projects = await o.vercel.projects();
  let states = await loadState(o, projects);

  if (o.mode === "apply") {
    const extras = new Map<string, Extras>();
    const ex = (id: string) => extras.get(id) ?? (extras.set(id, {}), extras.get(id)!);
    const sb = o.supabase;

    // 1) Supabase: settings, hub SQL, keys
    if (!sb) say("! No SUPABASE_ACCESS_TOKEN: skipping database setup, Supabase keys and new Wallet keys.");
    else {
      say("Supabase");
      if (o.dryRun) say(`  would switch on leaked-password protection (${supabaseRefs().length} projects) and run the hub SQL`);
      for (const ref of supabaseRefs()) {
        if (o.dryRun) continue;
        await sb.leakedPasswordProtection(ref).then(
          () => say(`  ✓ leaked-password protection on (${ref})`),
          (e: Error) => say(`  ! leaked-password protection (${ref}): ${e.message.includes("402") || /plan/i.test(e.message) ? "needs the Supabase Pro plan" : e.message}`),
        );
      }
      if (o.sqlFiles?.hubLint && !o.dryRun)
        await sb.sql(HUB_REF, o.sqlFiles.hubLint).then(() => say("  ✓ hub security fixes applied"), (e: Error) => say(`  ! hub security SQL: ${e.message}`));
      if (o.sqlFiles?.pcbDurable && !o.dryRun)
        await sb.sql(HUB_REF, o.sqlFiles.pcbDurable).then(() => say("  ✓ ContentBot durable-jobs columns ready"), (e: Error) => say(`  ! ContentBot SQL: ${e.message}`));
      if (o.sqlFiles?.pinixisTrigger && !o.dryRun)
        await sb.sql("jxtzdylmkulhbvpmkwsp", o.sqlFiles.pinixisTrigger).then(() => say("  ✓ Pinixis sign-up trigger"), (e: Error) => say(`  ! Pinixis trigger: ${e.message}`));
      const durable = await sb
        .sql<{ n: number }>(HUB_REF, "select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='pcb_jobs' and column_name='wallet_reservation_id'")
        .then((r) => (r[0]?.n ?? 0) > 0)
        .catch(() => false);
      ex("contentbot").durableJobsReady = durable;

      const keyCache = new Map<string, Awaited<ReturnType<Supabase["keys"]>>>();
      for (const s of states) {
        const ref = s.c.supabase?.ref;
        if (!s.project || !ref) continue;
        const needs = [...s.c.supabase!.url, ...s.c.supabase!.anon, "SUPABASE_SERVICE_ROLE_KEY"].some((n) => !isPresent(s.names, n));
        if (!needs) continue;
        // Never mix projects: if a Supabase URL is already set, it must point at the expected project.
        const urlRow = s.rows.find((r) => s.c.supabase!.url.includes(r.key));
        if (urlRow) {
          const current = await o.vercel.value(s.project, urlRow);
          if (!current || !current.includes(ref)) {
            say(`  ! ${s.c.label}: ${urlRow.key} is set to a different or unreadable project; not adding Supabase keys`);
            continue;
          }
        }
        if (!keyCache.has(ref)) keyCache.set(ref, await sb.keys(ref).catch(() => ({ url: `https://${ref}.supabase.co` })));
        ex(s.c.id).supabase = keyCache.get(ref);
      }
    }

    // 2) World keys (only when Apixis.dev's project is known, since it must store the hashes)
    const apixis = states.find((s) => s.c.id === "apixis");
    const worldHashes: Record<string, string> = {};
    let worldCurrent: string | undefined = "";
    const worldRow = apixis?.rows.find((r) => r.key === "APIXIS_WORLD_KEYS");
    if (apixis?.project && worldRow) worldCurrent = await o.vercel.value(apixis.project, worldRow);
    if (worldCurrent === undefined) say("! Apixis.dev: APIXIS_WORLD_KEYS is a sensitive var the kit cannot read; no new world keys made");
    else if (apixis?.project) {
      for (const s of states) {
        if (!s.c.world || !s.project || isPresent(s.names, "APIXIS_WORLD_KEY")) continue;
        const key = generateSecret("token");
        ex(s.c.id).worldKey = key;
        worldHashes[s.c.id] = sha256Hex(key);
      }
    }

    // 3) Wallet keys for clients whose Vercel project has none
    for (const s of states) {
      if (!s.c.wallet || !s.project || isPresent(s.names, "WALLET_API_KEY")) continue;
      if (!sb) continue;
      const site = FAMILY_SITES.find((x) => x.name === s.c.id);
      if (!site) {
        say(`  ! ${s.c.label}: not in scripts/family-sites.ts, no Wallet key minted`);
        continue;
      }
      const active = await sb
        .sql<{ n: number }>(WALLET_REF, `select count(*)::int as n from public.wallet_api_clients where name = ${q(site.name)} and active`)
        .catch(() => [{ n: -1 }]);
      if ((active[0]?.n ?? -1) !== 0) {
        say(
          active[0]?.n === -1
            ? `  ! ${s.c.label}: could not read the Wallet client list; no key minted`
            : `  ! ${s.c.label}: already has a Wallet key in the database but not in Vercel. Paste it into Vercel, or deactivate the old one (see scripts/create-family-keys.ts) and run the kit again.`,
        );
        continue;
      }
      const key = `apx_live_${randomBytes(32).toString("base64url")}`;
      if (!API_KEY_PATTERN.test(key)) throw new Error("bad key");
      if (!o.dryRun) {
        const callback = `https://${site.domain}/auth/apixis/callback`;
        const ok = await sb
          .sql(
            WALLET_REF,
            `insert into public.wallet_api_clients (name, app_slugs, key_prefix, key_hash, redirect_uris) values (${q(site.name)}, array[${site.apps
              .map(q)
              .join(", ")}]::text[], ${q(key.slice(0, 12))}, ${q(hashApiKey(key))}, array[${q(callback)}]::text[])`,
          )
          .then(
            () => true,
            (e: Error) => (say(`  ! ${s.c.label}: Wallet key not registered: ${e.message}`), false),
          );
        if (!ok) continue;
      }
      ex(s.c.id).walletKey = key;
      say(`  ${o.dryRun ? "would register" : "✓ registered"} a new Wallet key for ${s.c.label}`);
    }

    // 4) Vercel env vars
    say("Vercel");
    const changed = new Set<string>();
    for (const s of states) {
      if (!s.project) continue;
      const plan: PlannedVar[] = planCompany(s.c, s.names, o.keys, extras.get(s.c.id));
      if (s.c.id === "apixis" && Object.keys(worldHashes).length)
        plan.push({ name: "APIXIS_WORLD_KEYS", value: mergeWorldKeys(worldCurrent ?? "", worldHashes), source: "world" });
      if (!plan.length) continue;
      for (const v of plan) {
        if (o.dryRun) continue;
        const saved = await o.vercel.add(s.project, v.name, v.value, v.name === "APIXIS_WORLD_KEYS").then(
          () => (changed.add(s.c.id), true),
          (e: Error) => (say(`  ! ${s.c.label} ${v.name}: ${e.message}`), false),
        );
        // A Wallet key that never reached Vercel must not stay active, or the next run could never issue one.
        if (!saved && v.name === "WALLET_API_KEY" && sb)
          await sb
            .sql(WALLET_REF, `update public.wallet_api_clients set active = false where key_hash = ${q(hashApiKey(v.value))}`)
            .then(
              () => say(`  ! ${s.c.label}: the new Wallet key was switched off again; run the kit once more`),
              (e: Error) => say(`  ! ${s.c.label}: could not switch off the unsaved Wallet key: ${e.message}`),
            );
      }
      say(`  ${o.dryRun ? "would set" : "✓ set"} ${s.c.label}: ${plan.map((v) => `${v.name}${v.source === "generated" ? " (generated)" : ""}`).join(", ")}`);
    }

    // 5) Redeploy what changed
    if (!o.dryRun && changed.size) {
      say("Redeploy");
      for (const s of states) {
        if (!s.project || !changed.has(s.c.id)) continue;
        await o.vercel.redeploy(s.project).then(
          (r) => say(`  ✓ ${s.c.label}: ${r}`),
          (e: Error) => say(`  ! ${s.c.label}: ${e.message}`),
        );
      }
    }
    if (!o.dryRun) states = await loadState(o, projects);
  }

  const r = report(states);
  say("");
  say(`Status: ${r.ready} of ${r.total} companies ready`);
  for (const l of r.lines) say(l);
  return out;
}

// ---------------------------------------------------------------- CLI
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("check") || args.includes("--check") ? "check" : "apply";
  const dryRun = args.includes("--dry-run");
  const keysPath = resolve(process.cwd(), args.find((a) => a.startsWith("--keys="))?.slice(7) ?? ".env.launch");
  if (!existsSync(keysPath)) {
    console.error(`Missing ${keysPath}. Copy .env.launch.example to .env.launch and fill it in (see docs/LAUNCH_KIT.md).`);
    process.exit(1);
  }
  const text = readFileSync(keysPath, "utf8");
  const keys = parseKeysFile(text);
  const vercelSection = keys.sections["vercel"] ?? {};
  const overrides: Record<string, string> = {};
  // [vercel] lines look like `socixis=my-project`; parseKeysFile only keeps UPPERCASE names, so read them here.
  let inVercel = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[.*\]$/.test(line)) inVercel = line.toLowerCase() === "[vercel]";
    else if (inVercel && /^[a-z0-9-]+\s*=/.test(line)) {
      const [k, v] = line.split("=").map((x) => x.trim());
      if (v) overrides[k] = v;
    }
  }
  const token = keys.shared.VERCEL_TOKEN;
  if (!token) {
    console.error("VERCEL_TOKEN is empty in .env.launch (Vercel → Account Settings → Tokens).");
    process.exit(1);
  }
  const vercel = new Vercel(token, keys.shared.VERCEL_TEAM_ID ?? vercelSection.VERCEL_TEAM_ID);
  const supabase = keys.shared.SUPABASE_ACCESS_TOKEN ? new Supabase(keys.shared.SUPABASE_ACCESS_TOKEN) : undefined;
  const pinixisMigration = repoFile("..", "pinixis", "supabase", "migrations", "20261002000000_marketplace_foundation.sql");
  const trigger = pinixisMigration?.match(/drop trigger if exists on_auth_user_created[\s\S]*?execute function public\.handle_new_user\(\);/)?.[0];
  await run({
    mode,
    dryRun,
    keys,
    vercel,
    supabase,
    vercelOverrides: overrides,
    sqlFiles: {
      hubLint: repoFile("docs", "security", "2026-09-30-hub-project-lint.sql"),
      pcbDurable: repoFile("..", "personalcontentbot", "supabase", "pcb_jobs_durable.sql"),
      pinixisTrigger: trigger,
    },
  });
}

if (process.argv[1] && /launch[\\/]kit\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
