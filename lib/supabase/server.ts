import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public env is missing");
  return { url, key };
}

/** The signed-in Wallet user (id + email) from the Supabase session cookie, or null. */
export async function getAuthenticatedUser(): Promise<{ id: string; email: string | null; emailConfirmed: boolean } | null> {
  let jar;
  try {
    jar = await cookies();
  } catch {
    // Called outside request context (e.g., in tests) → no cookies available
    return null;
  }
  const { url, key } = publicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Route handlers can refresh the session. Ignore when the cookie jar is read-only.
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user
    ? { id: data.user.id, email: data.user.email ?? null, emailConfirmed: Boolean(data.user.email_confirmed_at) }
    : null;
}

/** The signed-in Wallet user id from the Supabase session cookie, or null. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  return (await getAuthenticatedUser())?.id ?? null;
}

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * The Wallet user behind a request: `Authorization: Bearer <Wallet Supabase access token>` when
 * present, otherwise the session cookie. The token is verified with Supabase (getUser), never decoded
 * and trusted locally. Only Wallet-issued tokens work; a sister site's own Supabase token does not.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (match) {
    const token = match[1].trim();
    if (!JWT.test(token)) return null;
    const { url, key } = publicEnv();
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  }
  return getAuthenticatedUserId();
}
