/**
 * Mint an Apixis Wallet API key + Apixis ID client for the family sites you NAME, and print
 * (1) one SQL block to paste into the Wallet Supabase SQL editor and (2) the env vars to paste into
 * each named site's Vercel project.
 *
 *   npm run family-keys -- --only ominix,wattixis          # live keys for those two sites
 *   npm run family-keys -- --only ominix --test             # test key
 *   npm run family-keys -- --list                           # show the known sites, mint nothing
 *
 * `--only` is required. Every site already registered keeps its key: minting a second row with the
 * same client name breaks "Sign in with Apixis" for that site (the Wallet looks clients up by name),
 * and migration 012 makes the database refuse it. To REPLACE a site's key, first run
 *   update public.wallet_api_clients set active = false where name = '<site>';
 * then mint it here.
 *
 * Keys are printed ONCE and never written to disk. Only their SHA-256 goes into the database.
 */
import { randomBytes } from "node:crypto";
import { API_KEY_PATTERN, hashApiKey } from "../lib/api/service-auth";

import { FAMILY_SITES } from "./family-sites";
export { FAMILY_SITES };

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const site of FAMILY_SITES) console.log(`${site.name.padEnd(14)} https://${site.domain}/auth/apixis/callback`);
  process.exit(0);
}

const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? args[args.indexOf("--only") + 1];
if (!args.some((a) => a === "--only" || a.startsWith("--only=")) || !onlyArg || onlyArg.startsWith("--")) {
  console.error("Name the sites to mint: npm run family-keys -- --only ominix,wattixis   (see --list)");
  console.error("Already-registered sites keep their keys; minting them again breaks their sign-in.");
  process.exit(1);
}
const wanted = new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean));
const unknown = [...wanted].filter((name) => !FAMILY_SITES.some((s) => s.name === name));
if (unknown.length) {
  console.error(`Unknown site(s): ${unknown.join(", ")}. Known: ${FAMILY_SITES.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

const mode = args.includes("--test") ? "test" : "live";
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
const rows: string[] = [];
const envBlocks: string[] = [];

for (const site of FAMILY_SITES.filter((s) => wanted.has(s.name))) {
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
console.log("If it says 'duplicate key value violates unique constraint wallet_api_clients_active_name_idx',");
console.log("that site already has a working key. Do not replace it unless you mean to (see the header of this script).\n");
console.log("=== 2) Paste into each site's Vercel → Settings → Environment Variables (Production), then Redeploy ===\n");
console.log(envBlocks.join("\n"));
console.log("These keys are shown once. Store them in Vercel now; they are not saved anywhere else.\n");
