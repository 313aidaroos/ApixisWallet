/**
 * One command for launch morning: mint an Apixis Wallet API key + Apixis ID client for every
 * family site, and print (1) one SQL block to paste into the Wallet Supabase SQL editor and
 * (2) the env vars to paste into each site's Vercel project.
 *
 *   npm run family-keys            # live keys
 *   npm run family-keys -- --test  # test keys
 *
 * Keys are printed ONCE and never written to disk. Only their SHA-256 goes into the database.
 * Domains below are the production hosts known on 2026-09-23 — edit before running if one changed.
 */
import { randomBytes } from "node:crypto";
import { API_KEY_PATTERN, hashApiKey } from "../lib/api/service-auth";

export const FAMILY_SITES = [
  { name: "renoxis", apps: ["renoxis"], domain: "renoxis.dev" },
  { name: "socixis", apps: ["socixis", "family"], domain: "socixis.dev" },
  { name: "recovra", apps: ["recovra"], domain: "recovra-three.vercel.app" },
  { name: "lyrixis", apps: ["lyrixis"], domain: "lyrixis.vercel.app" },
  { name: "rawixis", apps: ["rawixis"], domain: "rawixis.vercel.app" },
  { name: "contraxis", apps: ["contraxis"], domain: "contraxis-dev.vercel.app" },
  { name: "geoxis", apps: ["geoxis"], domain: "geoxis.vercel.app" },
  { name: "launchixis", apps: ["launchixis"], domain: "launchixis.vercel.app" },
  { name: "nurserytoons", apps: ["nurserytoons"], domain: "nurserytoons.vercel.app" },
  { name: "qahwahworld", apps: ["qahwahworld"], domain: "qahwahworld.vercel.app" },
  { name: "contentbot", apps: ["contentbot"], domain: "personalcontentbot.vercel.app" },
  { name: "deduxis", apps: ["deduxis"], domain: "deduxis.vercel.app" },
  { name: "apixis", apps: ["apixis"], domain: "apixis.dev" },
] as const;

const mode = process.argv.includes("--test") ? "test" : "live";
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
const rows: string[] = [];
const envBlocks: string[] = [];

for (const site of FAMILY_SITES) {
  const key = `apx_${mode}_${randomBytes(32).toString("base64url")}`;
  if (!API_KEY_PATTERN.test(key)) throw new Error("bad key");
  const callback = `https://${site.domain}/auth/apixis/callback`;
  rows.push(
    `  (${sql(site.name)}, array[${site.apps.map(sql).join(", ")}]::text[], ${sql(key.slice(0, 12))}, ${sql(hashApiKey(key))}, array[${sql(callback)}]::text[])`,
  );
  envBlocks.push(
    `# ${site.name}  →  Vercel project for ${site.domain}\nWALLET_API_KEY=${key}\nAPIXIS_CLIENT_ID=${site.name}\nAPIXIS_WALLET_API_URL=https://apixis-wallet.vercel.app\n`,
  );
}

console.log("\n=== 1) Paste into the apixis-wallet Supabase SQL editor (once) ===\n");
console.log(
  "insert into public.wallet_api_clients (name, app_slugs, key_prefix, key_hash, redirect_uris) values\n" +
    rows.join(",\n") +
    "\non conflict (key_hash) do nothing;\n",
);
console.log("=== 2) Paste into each site's Vercel → Settings → Environment Variables (Production) ===\n");
console.log(envBlocks.join("\n"));
console.log("These keys are shown once. Store them in Vercel now; they are not saved anywhere else.\n");
