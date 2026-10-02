/**
 * Pure planning logic for the launch kit (no network): parse .env.launch, decide which env vars a
 * company's Vercel project still needs, and explain what is missing. kit.ts does the I/O.
 * Values are never logged; only names.
 */
import { createHash, randomBytes } from "node:crypto";
import { ALTERNATIVES, type Company, type SecretFormat, WALLET_URL } from "./companies";

export interface KeysFile {
  shared: Record<string, string>;
  sections: Record<string, Record<string, string>>;
}

/** `NAME=value` lines; `[company]` starts a company section; everything before the first section is shared. */
export function parseKeysFile(text: string): KeysFile {
  const out: KeysFile = { shared: {}, sections: {} };
  let section: Record<string, string> = out.shared;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const head = line.match(/^\[([a-z0-9-]+)\]$/i);
    if (head) {
      const name = head[1].toLowerCase();
      section = name === "shared" ? out.shared : (out.sections[name] ??= {});
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
    if (/^[A-Z][A-Z0-9_]*$/.test(key) && value) section[key] = value;
  }
  return out;
}

export function isPresent(existing: Set<string>, name: string): boolean {
  return existing.has(name) || (ALTERNATIVES[name] ?? []).some((alt) => existing.has(alt));
}

export function generateSecret(format: SecretFormat, rand: (n: number) => Buffer = randomBytes): string {
  if (format === "hex32") return rand(32).toString("hex");
  if (format === "b64-32") return rand(32).toString("base64");
  return rand(32).toString("base64url");
}

export const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export type Source = "shared" | "own" | "generated" | "fixed" | "supabase" | "wallet" | "world";
export interface PlannedVar {
  name: string;
  value: string;
  source: Source;
}

export interface Extras {
  /** Values fetched from the Supabase Management API for this company's project (only when safe). */
  supabase?: { url: string; anon?: string; service?: string };
  /** A freshly minted Wallet API key (already registered in the Wallet database). */
  walletKey?: string;
  /** A freshly generated Apixis world key (its hash goes into APIXIS_WORLD_KEYS on Apixis.dev). */
  worldKey?: string;
  /** PersonalContentBot: durable-jobs columns exist in the hub database. */
  durableJobsReady?: boolean;
}

/** Env vars to ADD to this company's project. Anything already present (or a stand-in) is left alone. */
export function planCompany(c: Company, existing: Set<string>, keys: KeysFile, extras: Extras = {}): PlannedVar[] {
  const plan: PlannedVar[] = [];
  const add = (name: string, value: string | undefined, source: Source) => {
    if (!value || isPresent(existing, name) || plan.some((p) => p.name === name)) return;
    plan.push({ name, value, source });
  };
  if (c.supabase && extras.supabase) {
    for (const n of c.supabase.url) add(n, extras.supabase.url, "supabase");
    for (const n of c.supabase.anon) add(n, extras.supabase.anon, "supabase");
    add("SUPABASE_SERVICE_ROLE_KEY", extras.supabase.service, "supabase");
  }
  if (c.wallet) {
    add("WALLET_API_KEY", extras.walletKey, "wallet");
    add("APIXIS_CLIENT_ID", c.id, "fixed");
    add("APIXIS_WALLET_API_URL", WALLET_URL, "fixed");
  }
  if (c.world) add("APIXIS_WORLD_KEY", extras.worldKey, "world");
  for (const n of c.shared ?? []) add(n, keys.shared[n], "shared");
  for (const n of c.own ?? []) add(n, keys.sections[c.id]?.[n], "own");
  for (const [n, v] of Object.entries(c.fixed ?? {})) add(n, v, "fixed");
  for (const [n, f] of Object.entries(c.generate ?? {})) if (!isPresent(existing, n)) add(n, generateSecret(f), "generated");
  if (c.id === "contentbot" && extras.durableJobsReady) add("PCB_DURABLE_JOBS", "true", "fixed");
  return plan;
}

/** Where the owner gets a missing name from, in plain words. */
export function whereFrom(c: Company, name: string): string {
  if (c.shared?.includes(name)) return `[shared] ${name}`;
  if (c.own?.includes(name)) return `[${c.id}] ${name}`;
  if (name.includes("SUPABASE")) return `${name} (kit fills it once SUPABASE_ACCESS_TOKEN is in .env.launch)`;
  if (name === "WALLET_API_KEY") return "WALLET_API_KEY (kit mints it once SUPABASE_ACCESS_TOKEN is in .env.launch)";
  if (name === "APIXIS_WORLD_KEYS") return "APIXIS_WORLD_KEYS (kit builds it when it gives sites their world keys)";
  if (name === "PCB_DURABLE_JOBS") return "PCB_DURABLE_JOBS (kit sets it after the hub durable-jobs SQL ran)";
  if (c.generate?.[name]) return `${name} (kit generates it)`;
  return name;
}

export function missingRequired(c: Company, existing: Set<string>): string[] {
  return c.required.filter((n) => !isPresent(existing, n));
}

export function missingOptional(c: Company, existing: Set<string>): string[] {
  const optional = [...(c.shared ?? []), ...(c.own ?? [])].filter((n) => !c.required.includes(n));
  return optional.filter((n) => !isPresent(existing, n));
}

/** APIXIS_WORLD_KEYS = "client:sha256,...". New hashes replace that client's old entry; others stay. */
export function mergeWorldKeys(existingRaw: string, newHashes: Record<string, string>): string {
  const entries = new Map<string, string>();
  for (const part of existingRaw.split(",")) {
    const [name, hash] = part.split(":").map((s) => (s ?? "").trim());
    if (name && /^[0-9a-f]{64}$/i.test(hash ?? "")) entries.set(name.toLowerCase(), hash.toLowerCase());
  }
  for (const [name, hash] of Object.entries(newHashes)) entries.set(name, hash);
  return [...entries].map(([n, h]) => `${n}:${h}`).join(",");
}

export interface ProjectRef {
  id: string;
  name: string;
  repo?: string;
  teamId?: string;
}

/** The Vercel project linked to one of the company's repos. Leftover "temporary-*" projects are ignored. */
export function pickProject(c: Company, projects: ProjectRef[], override?: string): { project?: ProjectRef; problem?: string } {
  if (override) {
    const p = projects.find((x) => x.name === override);
    return p ? { project: p } : { problem: `Vercel project "${override}" (from [vercel] in .env.launch) not found` };
  }
  const repos = c.repos.map((r) => r.toLowerCase());
  const linked = projects.filter((p) => p.repo && repos.includes(p.repo.toLowerCase()) && !p.name.startsWith("temporary-"));
  if (linked.length === 1) return { project: linked[0] };
  if (linked.length === 0) return { problem: `no Vercel project linked to GitHub repo ${c.repos[0]}` };
  return {
    problem: `several Vercel projects use repo ${c.repos[0]} (${linked.map((p) => p.name).join(", ")}); add "${c.id}=<project>" under [vercel] in .env.launch`,
  };
}
