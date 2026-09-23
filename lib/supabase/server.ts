import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public env is missing");
  let jar;
  try {
    jar = await cookies();
  } catch {
    // Called outside request context (e.g., in tests) → no cookies available
    return null;
  }
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
  return data.user?.id ?? null;
}
