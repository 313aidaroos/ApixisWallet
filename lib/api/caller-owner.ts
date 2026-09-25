import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceCaller } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OwnerResolution = { ownerId: string | null } | { error: string; status: number };

/**
 * Who is this service call about?
 *  - owner_id (the `sub` from Apixis ID): a per-site key may use it only for people who signed in to
 *    that site through Apixis ID (sso_links). The legacy key may use any Wallet id.
 *  - owner_email: the pre-Apixis-ID path. Refused once the site is switched to require_sso.
 * `create` lets a reserve create the Wallet account for a new email; reads never create.
 */
export async function ownerForCaller(
  supabase: SupabaseClient,
  caller: ServiceCaller,
  input: { ownerId?: string | null; ownerEmail?: string | null },
  options: { create: boolean },
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
    if (!data) return { error: "This person has not signed in to your site with Apixis ID", status: 403 };
    return { ownerId };
  }

  if (ownerEmail) {
    if (caller.requireSso) return { error: "This site must use Apixis ID (owner_id), not owner_email", status: 403 };
    const resolved = await resolveOwnerByEmail(supabase, ownerEmail, { create: options.create });
    if ("error" in resolved) return { error: resolved.error, status: 400 };
    return { ownerId: resolved.ownerId };
  }

  return { error: "owner_id (Apixis ID) or owner_email required", status: 400 };
}
