/**
 * Post-pay return URLs. Exact hosts only — a prefix like `socixis-*.vercel.app`
 * would trust a lookalike Vercel project name.
 *
 * Family DNS (`apixis.dev`) is allowed at any subdomain.
 * Known production `project.vercel.app` hosts are listed below.
 * Preview and custom hosts belong in CHECKOUT_RETURN_HOSTS (exact hostnames, no wildcards).
 */

/** Production Vercel aliases for Apixis family products named in this repo. */
export const VERCEL_PRODUCT_HOSTS = [
  "apixis-wallet.vercel.app",
  "apixis.vercel.app",
  "socixis.vercel.app",
  "renoxis.vercel.app",
  "recovra.vercel.app",
  "deduxis.vercel.app",
  "contraxis.vercel.app",
  "contentbot.vercel.app",
  "personalcontentbot.vercel.app",
  "cixy.vercel.app",
  "lyrixis.vercel.app",
  "rawixis.vercel.app",
  "halaxis.vercel.app",
] as const;

const FAMILY_DOMAINS = ["apixis.dev"] as const;

const vercelHostSet = new Set<string>(VERCEL_PRODUCT_HOSTS);

export type AllowOptions = {
  /** Exact hostnames. When omitted, CHECKOUT_RETURN_HOSTS is read. Pass [] in tests. */
  extraHosts?: readonly string[];
  /** http://localhost and http://127.0.0.1. Defaults to off in production. */
  allowHttpLocalhost?: boolean;
};

function localhostAllowed(options?: AllowOptions) {
  if (options?.allowHttpLocalhost !== undefined) return options.allowHttpLocalhost;
  return process.env.NODE_ENV !== "production";
}

export function extraReturnHosts(source = process.env.CHECKOUT_RETURN_HOSTS): string[] {
  if (!source) return [];
  return source.split(",").map(normalizeHostToken).filter((host): host is string => Boolean(host));
}

function normalizeHostToken(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value.includes("*") || /[\s\\]/.test(value)) return null;
  if (value.includes("://")) {
    try {
      return new URL(value).hostname.replace(/\.$/, "");
    } catch {
      return null;
    }
  }
  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  return value.replace(/\.$/, "");
}

function resolvedExtra(options?: AllowOptions) {
  if (options?.extraHosts) return options.extraHosts.map(normalizeHostToken).filter((host): host is string => Boolean(host));
  return extraReturnHosts();
}

function familyHost(host: string) {
  return FAMILY_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function hostAllowed(host: string, extra: readonly string[]) {
  return vercelHostSet.has(host) || familyHost(host) || extra.includes(host);
}

/** Canonical https URL, or null when the host is not allowlisted. */
export function canonicalReturnUrl(raw: string, options?: AllowOptions): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/[\u0000-\u001F\u007F\\\s]/.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return null;

  const path = url.pathname.replace(/\/$/, "") || "/";
  const walletHost = host === "apixis-wallet.vercel.app" || host === "localhost" || host === "127.0.0.1";
  if (walletHost && (path === "/buy/success" || path === "/api/checkout/return")) return null;

  const local = host === "localhost" || host === "127.0.0.1";
  if (local) {
    if (!localhostAllowed(options)) return null;
    if (url.protocol !== "http:") return null;
  } else {
    if (url.protocol !== "https:") return null;
    if (url.port) return null;
    if (!hostAllowed(host, resolvedExtra(options))) return null;
  }

  url.hash = "";
  return url.href;
}

export function isAllowlistedReturnUrl(raw: string, options?: AllowOptions) {
  return canonicalReturnUrl(raw, options) !== null;
}

export function returnHost(raw: string, options?: AllowOptions) {
  const canonical = canonicalReturnUrl(raw, options);
  if (!canonical) return null;
  return new URL(canonical).host;
}
