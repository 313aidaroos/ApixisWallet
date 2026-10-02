/**
 * Live smoke test for every family site: is it up, and does "Log in with Apixis ID" hand off to the Wallet with the
 * right client? Read-only (GET requests, no sign-in, no money). Run: `npm run launch:smoke`.
 * Needs outbound access to the sites (in a Claude environment: allow *.vercel.app and the family domains).
 */
import { FAMILY_SITES } from "../family-sites";
import { WALLET_URL } from "./companies";

/** Where each site's "Log in with Apixis ID" starts. Next.js sites use app routes; static sites use Vercel functions. */
const START_PATH: Record<string, string | null> = {
  wattixis: "/api/auth/apixis/start",
  geoxis: "/api/auth/apixis/start",
  nurserytoons: "/api/auth/apixis/start",
  apixis: null, // Apixis.dev signs in through /enter (its own flow); only the home page is checked.
};
const EXTRA_SITES = [{ name: "pinixis", domain: "pinixis.vercel.app", login: false }];

export interface Check {
  site: string;
  what: string;
  ok: boolean;
  detail: string;
}

/** A start route must redirect to the Wallet's /sso/authorize with this site's client_id and its own callback. */
export function checkStartRedirect(site: string, domain: string, status: number, location: string | null): Check {
  const what = "Apixis ID hand-off";
  if (status < 300 || status >= 400 || !location) return { site, what, ok: false, detail: `expected a redirect, got ${status}` };
  let url: URL;
  try {
    url = new URL(location, `https://${domain}`);
  } catch {
    return { site, what, ok: false, detail: `bad redirect ${location}` };
  }
  const wallet = new URL(WALLET_URL);
  if (url.host !== wallet.host || url.pathname !== "/sso/authorize")
    return { site, what, ok: false, detail: `redirects to ${url.host}${url.pathname}, not the Wallet` };
  const client = url.searchParams.get("client_id");
  if (client !== site) return { site, what, ok: false, detail: `client_id=${client}, expected ${site}` };
  const back = url.searchParams.get("redirect_uri") ?? "";
  if (!back.startsWith("https://")) return { site, what, ok: false, detail: `redirect_uri not https: ${back}` };
  return { site, what, ok: true, detail: `→ Wallet, client ${client}, back to ${new URL(back).host}` };
}

async function get(url: string) {
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "apixis-launch-smoke" } });
  return { status: res.status, location: res.headers.get("location") };
}

export async function smoke(): Promise<Check[]> {
  const checks: Check[] = [];
  const sites = [
    ...FAMILY_SITES.map((s) => ({ name: s.name, domain: s.domain, login: true })),
    ...EXTRA_SITES,
  ];
  const wallet = await get(`${WALLET_URL}/`).catch((e: Error) => ({ status: 0, location: e.message }));
  checks.push({ site: "wallet", what: "home", ok: wallet.status > 0 && wallet.status < 500, detail: `HTTP ${wallet.status}` });
  for (const s of sites) {
    const home = await get(`https://${s.domain}/`).catch((e: Error) => ({ status: 0, location: e.message }));
    checks.push({ site: s.name, what: "home", ok: home.status > 0 && home.status < 500, detail: `HTTP ${home.status || home.location}` });
    const path = s.login ? (s.name in START_PATH ? START_PATH[s.name] : "/auth/apixis/start") : null;
    if (!path) continue;
    const start = await get(`https://${s.domain}${path}`).catch(() => ({ status: 0, location: null }));
    checks.push(checkStartRedirect(s.name, s.domain, start.status, start.location));
  }
  return checks;
}

if (process.argv[1]?.endsWith("smoke.ts")) {
  smoke().then((checks) => {
    for (const c of checks) console.log(`${c.ok ? "OK  " : "FAIL"}  ${c.site.padEnd(13)} ${c.what.padEnd(20)} ${c.detail}`);
    const bad = checks.filter((c) => !c.ok).length;
    console.log(bad ? `\n${bad} check(s) failed.` : "\nEvery site is up and hands sign-in to the Wallet.");
    process.exit(bad ? 1 : 0);
  });
}
