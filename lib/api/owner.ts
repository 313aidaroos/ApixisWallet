import type { SupabaseClient } from "@supabase/supabase-js";

const CLEARING_OWNER = "00000000-0000-0000-0000-000000000000";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Family identity: one human, many Supabase projects.
 *
 * Every sister site has its own auth.users, so the same person has a different uid on
 * every site. The Wallet's wallets/entitlements reference the WALLET's auth.users, so a
 * sister-site uid is meaningless here. The identifier that is identical everywhere is
 * the verified email. Sister sites send `owner_email`; we map it to the Wallet's own
 * user. With `create: true` (reserve only) we create a confirmed passwordless user on first
 * sight so that when this person later signs in to the Wallet with that email, they land on
 * the same balance. Reads never create users.
 *
 * Only reachable behind service auth (money routes), never from a browser.
 * TRUST: the Wallet believes the email a sister-site server sends. Every sister site MUST only
 * send an email its own auth has verified (see AGENTS.md → Identity).
 */
export async function resolveOwnerByEmail(
  supabase: SupabaseClient,
  emailRaw: string,
  options: { create?: boolean } = { create: true },
): Promise<{ ownerId: string } | { ownerId: null } | { error: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "owner_email is not a valid email" };

  const { data: found, error: findError } = await supabase.rpc("find_user_id_by_email", { p_email: email });
  if (findError) return { error: "Could not resolve wallet owner" };
  if (typeof found === "string" && found) {
    if (found === CLEARING_OWNER) return { error: "owner_email is not a customer" };
    return { ownerId: found };
  }
  if (!options.create) return { ownerId: null };

  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { created_by: "sister-site-redeem" },
  });
  if (created.error || !created.data.user) {
    // Race: another request created it between our lookup and insert.
    const { data: again } = await supabase.rpc("find_user_id_by_email", { p_email: email });
    if (typeof again === "string" && again) return { ownerId: again };
    return { error: "Could not resolve wallet owner" };
  }
  return { ownerId: created.data.user.id };
}
