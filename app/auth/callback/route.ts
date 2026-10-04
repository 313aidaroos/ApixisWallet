import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { skipSetPassword } from "@/lib/auth-next";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientContext, ensureSignupGrant } from "@/lib/signup-grant";

/**
 * Magic-link / email-confirmation landing. Sends the person on to `next` (same-origin only),
 * skipping /set-password when they already have one (see lib/auth-next.ts).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  let next = safeLocalRedirect(url.searchParams.get("next"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key) return NextResponse.redirect(new URL("/login", url.origin));
  const jar = await cookies();
  const supabase = createServerClient(supabaseUrl, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
  let user = null;
  if (code) user = (await supabase.auth.exchangeCodeForSession(code)).data?.user ?? null;
  // "email" accepts magic-link, signup-confirmation and email-change tokens alike. GoTrue mints a
  // `signup` token for an address it has never seen, which `type: "magiclink"` rejects.
  else if (token_hash) user = (await supabase.auth.verifyOtp({ type: "email", token_hash })).data?.user ?? null;
  // Apixis ID welcome grant (1,000 bonus Ixis, once). No-op unless SIGNUP_GRANT_ENABLED; never blocks sign-in.
  if (user?.id) await ensureSignupGrant(createServiceSupabase(), user.id, { source: "auth_callback", ...clientContext(request.headers) });
  next = skipSetPassword(next, user?.user_metadata?.password_set === true);
  return NextResponse.redirect(new URL(next, url.origin));
}
