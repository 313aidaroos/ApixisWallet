import { redeemCatalog, shopCatalog } from "@/lib/catalog";

/**
 * Where a new Ixis pack can be aimed after checkout.
 * Slugs are the `product` / `app` query values sister sites send.
 * There is no per-app balance. Redeem spends the Wallet ledger.
 */

const LABELS: Record<string, string> = {
  wallet: "Apixis Wallet",
  renoxis: "Renoxis",
  socixis: "Socixis",
  recovra: "Recovra",
  deduxis: "Deduxis",
  contentbot: "PersonalContentBot",
  apixis: "Apixis.dev",
  contraxis: "Contraxis",
  family: "Family",
  cixy: "Cixy",
};

const CATALOG_APP_SLUG: Record<string, string> = {
  Renoxis: "renoxis",
  Socixis: "socixis",
  Recovra: "recovra",
  Deduxis: "deduxis",
  PersonalContentBot: "contentbot",
  "Apixis.dev": "apixis",
  Apixis: "apixis",
  Contraxis: "contraxis",
  Family: "family",
  Cixy: "cixy",
};

const ALIASES: Record<string, string> = {
  wallet: "wallet",
  "apixis-wallet": "wallet",
  apixiswallet: "wallet",
  socixis: "socixis",
  renoxis: "renoxis",
  recovra: "recovra",
  deduxis: "deduxis",
  contraxis: "contraxis",
  contentbot: "contentbot",
  personalcontentbot: "contentbot",
  "personal-content-bot": "contentbot",
  apixis: "apixis",
  "apixis.dev": "apixis",
  apixisdev: "apixis",
  family: "family",
  cixy: "cixy",
};

export type Destination = { slug: string; label: string };

export function appSlug(app: string) {
  return CATALOG_APP_SLUG[app] ?? app.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function destinationChoices(): Destination[] {
  const seen = new Set<string>(["wallet"]);
  const items: Destination[] = [{ slug: "wallet", label: LABELS.wallet }];
  for (const item of [...redeemCatalog, ...shopCatalog]) {
    const slug = appSlug(item.app);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    items.push({ slug, label: LABELS[slug] ?? item.app });
  }
  return items;
}

export function resolveDestination(raw: string | null | undefined): Destination | null {
  const key = (raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!key) return null;
  const slug = ALIASES[key] ?? ALIASES[key.replace(/-/g, "")];
  if (!slug) return null;
  const known = destinationChoices().some((item) => item.slug === slug);
  if (!known) return null;
  return { slug, label: LABELS[slug] ?? slug };
}

export function productsForDestination(slug: string) {
  return [...redeemCatalog, ...shopCatalog].filter((item) => appSlug(item.app) === slug);
}
