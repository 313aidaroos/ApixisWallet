/**
 * Mint a per-site Wallet API key.
 *
 *   npx tsx scripts/create-api-key.ts --name renoxis --apps renoxis
 *   npx tsx scripts/create-api-key.ts --name socixis --apps socixis,family --test
 *
 * Prints the key ONCE and the SQL that stores only its SHA-256 hash. Nothing is sent anywhere:
 * paste the SQL into the Supabase SQL editor of the Wallet project, then put the key in the sister
 * site's Vercel env as WALLET_API_KEY. To revoke:
 *   update public.wallet_api_clients set active = false, revoked_at = now() where name = '<name>';
 */
import { randomBytes } from "node:crypto";
import { API_KEY_PATTERN, hashApiKey } from "../lib/api/service-auth";
import { canonicalAppSlug } from "../lib/checkout/destinations";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = (arg("name") ?? "").trim();
const apps = (arg("apps") ?? "")
  .split(",")
  .map((app) => canonicalAppSlug(app))
  .filter(Boolean);
const mode = process.argv.includes("--test") ? "test" : "live";

if (!/^[a-z0-9][a-z0-9._-]{1,60}$/.test(name) || apps.length === 0) {
  console.error("usage: npx tsx scripts/create-api-key.ts --name <site-name> --apps <app1,app2> [--test]");
  process.exit(1);
}

const key = `apx_${mode}_${randomBytes(32).toString("base64url")}`;
if (!API_KEY_PATTERN.test(key)) throw new Error("generated key does not match API_KEY_PATTERN");
const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const appArray = `array[${apps.map(sqlText).join(", ")}]::text[]`;

console.log(`\nWALLET_API_KEY for ${name} (shown once — store it in that site's Vercel env now):\n\n  ${key}\n`);
console.log("Run in the Wallet Supabase SQL editor:\n");
console.log(
  `insert into public.wallet_api_clients (name, app_slugs, key_prefix, key_hash)\n` +
    `values (${sqlText(name)}, ${appArray}, ${sqlText(key.slice(0, 12))}, ${sqlText(hashApiKey(key))});\n`,
);
