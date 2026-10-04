import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceCaller } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Family-wide feed clients (one Apixis ID = one Wallet across every family site).
 * On the marketplace order routes ONLY (open order / tip, settle), these clients may name a
 * buyer/seller who signed in with Apixis ID on ANY active family site, not just their own.
 * Keep this list tiny and explicit; adding a name here widens who that key can charge.
 */
export const FEED_CLIENTS: readonly string[] = ["apixis"];

/** Set only when a FEED_CLIENTS key relied on another family site's Apixis ID sign-in. */
export type OwnerLink = { via: "cross_site"; feed_client: string; linked_client: string };

export type OwnerResolution =
  | { ownerId: string | null; link?: OwnerLink }
  | { error: string; status: number; code?: string };

/** Audit `details` fragment for a resolved owner (empty unless a cross-site link was used). */
export function ownerLinkAudit(resolution: OwnerResolution, role: "buyer" | "seller") {
  if ("error" in resolution || resolution.link?.via !== "cross_site") return {};
  return { [`${role}_link`]: { cross_site: true, feed_client: resolution.link.feed_client, linked_client: resolution.link.linked_client } };
}

export function isFeedClient(caller: ServiceCaller) {
  return !caller.legacy && !!caller.clientId && !!caller.clientName && FEED_CLIENTS.includes(caller.clientName);
}

/**
 * Who is this service call about?
 *  - owner_id (the `sub` from Apixis ID): a per-site key may use it only for people who signed in to
 *    that site through Apixis ID (sso_links). The legacy key may use any Wallet id.
 *    Exception (`marketplace: true` + a FEED_CLIENTS key): a sign-in on any ACTIVE family client counts.
 *    sso_links.user_id references auth.users, so a link also proves the Wallet user exists.
 *  - owner_email: the pre-Apixis-ID path. Refused once the site is switched to require_sso.
 * `create` lets a reserve create the Wallet account for a new email; reads never create.
 */
export async function ownerForCaller(
  supabase: SupabaseClient,
  caller: ServiceCaller,
  input: { ownerId?: string | null; ownerEmail?: string | null },
  options: { create: boolean; marketplace?: boolean },
): Promise<OwnerResolution> {
  const ownerId = input.ownerId?.trim() || null;
  const ownerEmail = input.ownerEmail?.trim() || null;

  if (ownerId) {
    if (!UUID.test(ownerId)) return { error: "owner_id must be the Apixis ID `sub`", status: 400 };
    if (caller.legacy) return { ownerId };
    if (!caller.clientId) return { error: "Forbidden", status: 403 };
    const { data, error } = await supabase
      .from("sso_links")
      .select("user_id")
      .eq("client_id", caller.clientId)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (error) return { error: "Could not verify Apixis ID link", status: 503 };
    if (data) return { ownerId };
    if (options.marketplace && isFeedClient(caller)) return familyLink(supabase, caller, ownerId);
    return { error: "This person has not signed in to your site with Apixis ID", status: 403 };
  }

  if (ownerEmail) {
    if (caller.requireSso) return { error: "This site must use Apixis ID (owner_id), not owner_email", status: 403 };
    const resolved = await resolveOwnerByEmail(supabase, ownerEmail, { create: options.create });
    if ("error" in resolved) return { error: resolved.error, status: 400 };
    return { ownerId: resolved.ownerId };
  }

  return { error: "owner_id (Apixis ID) or owner_email required", status: 400 };
}

/** FEED_CLIENTS only: accept an Apixis ID that signed in on any active family client. Read-only. */
async function familyLink(supabase: SupabaseClient, caller: ServiceCaller, ownerId: string): Promise<OwnerResolution> {
  const links = await supabase.from("sso_links").select("client_id").eq("user_id", ownerId).limit(50);
  if (links.error) return { error: "Could not verify Apixis ID link", status: 503 };
  const clientIds = (links.data ?? []).map((row) => row.client_id as string).filter(Boolean);
  if (clientIds.length > 0) {
    const clients = await supabase.from("wallet_api_clients").select("id, name").in("id", clientIds).eq("active", true).limit(1);
    if (clients.error) return { error: "Could not verify Apixis ID link", status: 503 };
    const linked = clients.data?.[0];
    if (linked) {
      return { ownerId, link: { via: "cross_site", feed_client: caller.clientName as string, linked_client: linked.name as string } };
    }
  }
  return {
    error: "This Apixis ID is not a Wallet user who has signed in to any Apixis family site",
    status: 403,
    code: "apixis_id_not_linked",
  };
}
