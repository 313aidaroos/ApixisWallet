import type { PackRef } from "@/lib/stripe/fulfillment";
import { resolveDestination } from "@/lib/checkout/destinations";
import { canonicalReturnUrl, returnHost, type AllowOptions } from "@/lib/checkout/return-url";

export type CheckoutIntent = {
  returnUrl: string | null;
  destinationApp: string | null;
};

export function parseCheckoutExtras(
  input: { returnUrl?: string | null; product?: string | null },
  options?: AllowOptions,
): { ok: true; intent: CheckoutIntent } | { ok: false; error: string } {
  const returnRaw = input.returnUrl?.trim() ?? "";
  let returnUrl: string | null = null;
  if (returnRaw) {
    if (returnRaw.length > 500) return { ok: false, error: "return_url is too long" };
    const canonical = canonicalReturnUrl(returnRaw, options);
    if (!canonical) return { ok: false, error: "return_url is not an allowlisted Apixis host" };
    returnUrl = canonical;
  }

  const productRaw = input.product?.trim() ?? "";
  let destinationApp: string | null = null;
  if (productRaw) {
    const destination = resolveDestination(productRaw);
    if (!destination) return { ok: false, error: "product is not a known Apixis app" };
    destinationApp = destination.slug;
  }

  return { ok: true, intent: { returnUrl, destinationApp } };
}

export function buildPackMetadata(pack: { id: string; xp: number }, intent: CheckoutIntent) {
  const metadata: Record<string, string> = {
    pack_id: pack.id,
    ixis: String(pack.xp),
    sku_type: "ixis_pack",
  };
  if (intent.returnUrl) metadata.return_url = intent.returnUrl;
  if (intent.destinationApp) metadata.destination_app = intent.destinationApp;
  return metadata;
}

export function readPackMetadata(
  metadata: { [key: string]: string } | null | undefined,
  options?: AllowOptions,
): CheckoutIntent & { packId: string | null; ixis: string | null; returnHost: string | null } {
  const returnRaw = metadata?.return_url?.trim() ?? "";
  const returnUrl = returnRaw ? canonicalReturnUrl(returnRaw, options) : null;
  const destinationApp = resolveDestination(metadata?.destination_app ?? "")?.slug ?? null;
  return {
    returnUrl,
    destinationApp,
    packId: metadata?.pack_id ?? null,
    ixis: metadata?.ixis ?? null,
    returnHost: returnUrl ? returnHost(returnUrl, options) : null,
  };
}

export function packFromMetadata(metadata: { [key: string]: string } | null | undefined, packs: readonly PackRef[]) {
  const packId = metadata?.pack_id ?? "";
  const pack = packs.find((item) => item.id === packId);
  if (!pack) return null;
  if (metadata?.sku_type !== "ixis_pack") return null;
  if (metadata?.ixis !== String(pack.xp)) return null;
  return pack;
}

export function checkoutUrls(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    success_url: `${base}/buy/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?checkout=cancelled`,
  };
}

/** Dashboard label. Suffix is 8 letters, per Checkout Session integration_identifier. */
export function integrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % 26];
  return `apixis_wallet_ixis_${suffix}`;
}

export function buildCheckoutSessionParams(input: {
  origin: string;
  userId: string;
  pack: { id: string; xp: number };
  intent: CheckoutIntent;
  integrationIdentifier: string;
}) {
  const metadata = buildPackMetadata(input.pack, input.intent);
  const paymentMetadata: Record<string, string> = { ...metadata, owner_id: input.userId };
  const urls = checkoutUrls(input.origin);
  return {
    mode: "payment" as const,
    success_url: urls.success_url,
    cancel_url: urls.cancel_url,
    client_reference_id: input.userId,
    metadata,
    payment_intent_data: { metadata: paymentMetadata },
    integration_identifier: input.integrationIdentifier,
  };
}
