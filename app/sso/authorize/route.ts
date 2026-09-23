import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import {
  SSO_CLIENT_PATTERN,
  SSO_STATE_PATTERN,
  hashSsoCode,
  newSsoCode,
  redirectUriAllowed,
  redirectWithParams,
} from "@/lib/sso";

export const runtime = "nodejs";

const bad = (message: string) =>
  new NextResponse(`Apixis ID: ${message}`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * "Sign in with Apixis". A sister site sends the browser here; if the person is signed in to the
 * Wallet they go straight back with a one-time code, otherwise they sign in first and come back here.
 * Errors about the client or redirect_uri are shown here and never redirected (no open redirect).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientName = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!SSO_CLIENT_PATTERN.test(clientName)) return bad("unknown client_id");
  if (!SSO_STATE_PATTERN.test(state)) return bad("state must be 16–200 URL-safe characters");

  const supabase = createServiceSupabase();
  if (!supabase) return new NextResponse("Apixis ID is not configured", { status: 503 });

  const { data: client, error } = await supabase
    .from("wallet_api_clients")
    .select("*")
    .eq("name", clientName)
    .eq("active", true)
    .maybeSingle();
  if (error) return new NextResponse("Apixis ID is unavailable", { status: 503 });
  const registered = Array.isArray(client?.redirect_uris) ? (client.redirect_uris as string[]) : [];
  if (!client || !redirectUriAllowed(redirectUri, registered)) return bad("redirect_uri is not registered for this client");

  let user;
  try {
    user = await getAuthenticatedUser();
  } catch {
    return new NextResponse("Apixis ID is not configured", { status: 503 });
  }
  if (!user) {
    const here = `${url.pathname}${url.search}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(here)}`, url.origin), 302);
  }
  if (!user.email || !user.emailConfirmed) {
    return NextResponse.redirect(redirectWithParams(redirectUri, { error: "email_not_verified", state }), 302);
  }

  const code = newSsoCode();
  const { error: insertError } = await supabase.from("sso_codes").insert({
    code_hash: hashSsoCode(code),
    client_id: client.id,
    user_id: user.id,
    email: user.email.toLowerCase(),
    redirect_uri: redirectUri,
  });
  if (insertError) return new NextResponse("Apixis ID is unavailable", { status: 503 });

  return NextResponse.redirect(redirectWithParams(redirectUri, { code, state }), 302);
}
