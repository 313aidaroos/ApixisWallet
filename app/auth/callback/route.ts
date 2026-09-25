import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const next = safeLocalRedirect(url.searchParams.get("next"));
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
  if (code) await supabase.auth.exchangeCodeForSession(code);
  else if (token_hash) await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
  return NextResponse.redirect(new URL(next, url.origin));
}
