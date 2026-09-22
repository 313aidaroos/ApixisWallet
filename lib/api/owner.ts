import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Family identity: one human, many Supabase projects.
 *
 * Every sister site has its own auth.users, so the same person has a different uid on
 * every site. The Wallet's wallets/entitlements reference the WALLET's auth.users, so a
 * sister-site uid is meaningless here. The identifier that is identical everywhere is
 * the verified email. Sister sites send `owner_email`; we map it to the Wallet's own
 * user, creating a confirmed passwordless user on first sight so that when this person
 * later signs in to the Wallet with that email, they land on the same balance.
 *
 * Only reachable behind the service bearer (money routes), never from a browser.
 */
export async function resolveOwnerByEmail(
  supabase: SupabaseClient,
  emailRaw: string
): Promise<{ ownerId: string } | { error: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "owner_email is not a valid email" };

  const { data: found } = await supabase.rpc("find_user_id_by_email", { p_email: email });
  if (typeof found === "string" && found) return { ownerId: found };

  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { created_by: "sister-site-redeem" },
  });
  if (created.error || !created.data.user) {
    // Race: another request created it between our lookup and insert.
    const { data: again } = await supabase.rpc("find_user_id_by_email", { p_email: email });
    if (typeof again === "string" && again) return { ownerId: again };
    return { error: `Could not resolve wallet owner: ${created.error?.message ?? "unknown"}` };
  }
  return { ownerId: created.data.user.id };
}
