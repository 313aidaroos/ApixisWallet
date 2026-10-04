"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { resetRedirectUrl } from "@/lib/auth-reset";
import { isMasterEmail, MASTER_EMAIL } from "@/lib/owners";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientContext, ensureSignupGrant } from "@/lib/signup-grant";

/**
 * Result of a login form action. `redirectTo` is always a same-origin path (safeLocalRedirect).
 * The page does a full navigation to it (window.location.assign) instead of a server-action
 * redirect(): `next` is usually /sso/authorize, a route handler that 302s to a sister site's
 * callback, and a client-router (RSC) fetch of that chain would burn the one-time code.
 * 2026-09-28 Grok Developer Bot: login() used to redirect("/") and drop `next`, so
 * "Sign in with Apixis" from a product never came back to /sso/authorize.
 */
export type LoginResult = { message?: string; redirectTo?: string };

async function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public env is missing");
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => jar.set(name, value, options));
      },
    },
  });
}

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
}

/** Where the email link lands: /auth/callback, which then sends the person on to `next`. */
function emailCallback(next: string) {
  return `${appBase()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function login(form: FormData): Promise<LoginResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeLocalRedirect(form.get("next"));
  const supabase = await client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials") return { message: "Invalid email or password." };
    if (error.code === "email_not_confirmed") return { message: "Confirm your email first: open the link we sent you, then log in again." };
    return { message: error.message };
  }
  // Apixis ID welcome grant (1,000 bonus Ixis, once). No-op unless SIGNUP_GRANT_ENABLED; never blocks sign-in.
  if (data.user?.id) {
    await ensureSignupGrant(createServiceSupabase(), data.user.id, { source: "password_login", ...clientContext(await headers()) });
  }
  return { redirectTo: next };
}

export async function signup(form: FormData): Promise<LoginResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeLocalRedirect(form.get("next"));
  if (password.length < 8) return { message: "Password must be at least 8 characters." };
  const supabase = await client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // The confirmation link keeps `next`, so an Apixis ID sign-up from a product returns to it.
    options: { emailRedirectTo: emailCallback(next) },
  });
  if (error) return { message: error.message };
  // Email confirmation off: already signed in, carry on to `next`.
  if (data.session) return { redirectTo: next };
  if (isMasterEmail(email) || email === MASTER_EMAIL) {
    return { message: "Master account created. If email confirm is on, open the mail, then sign in with this password." };
  }
  return { message: "Account created. Confirm your email (the link brings you back here), then sign in." };
}

/** Magic link: the default way in. `next` is where the user was headed (e.g. /sso/authorize?...); same-origin only. */
export async function magicLink(form: FormData): Promise<LoginResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeLocalRedirect(form.get("next"));
  if (!email.includes("@")) return { message: "Enter your email." };
  const supabase = await client();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: emailCallback(`/set-password?next=${encodeURIComponent(next)}`),
    },
  });
  if (error) return { message: error.message };
  return { message: `Check ${email} — the sign-in link is on its way. First time? You will choose a password after it opens.` };
}

/** Called from /set-password after a magic-link sign-in. */
export async function setPassword(form: FormData): Promise<LoginResult> {
  const password = String(form.get("password") ?? "");
  const next = safeLocalRedirect(form.get("next"));
  if (password.length < 8) return { message: "Password must be at least 8 characters." };
  const supabase = await client();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Your sign-in link expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
  if (error) return { message: error.message };
  return { redirectTo: next };
}

/**
 * 2026-09-28 Grok Developer Bot: "Forgot password?". Implicit-flow client so the emailed link works in
 * any browser (see lib/auth-reset.ts); lands on /set-password?reset=1&next=<next>.
 * Same answer whether or not the address has an account.
 */
export async function resetPassword(form: FormData): Promise<LoginResult & { sent?: boolean }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeLocalRedirect(form.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: "Enter the email you use for Apixis ID." };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { message: "Password reset is unavailable right now. Use an email link instead." };
  const supabase = createClient(url, key, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl(appBase(), next) });
  if (error && error.status === 429) return { message: "A reset email was sent very recently. Wait a minute, then try again." };
  if (error && (error.status ?? 500) >= 500) return { message: "Password reset is unavailable right now. Use an email link instead." };
  return { sent: true, message: `If ${email} has an Apixis ID, a password reset link is on its way. It expires in 1 hour.` };
}

/** /set-password?reset=1: turns the recovery tokens from the email link's URL hash into the session cookie. */
export async function startRecovery(accessToken: string, refreshToken: string): Promise<{ ok: boolean; message?: string }> {
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !accessToken || !refreshToken) {
    return { ok: false, message: "This reset link did not work. Request a new one below." };
  }
  const supabase = await client();
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error || !data.user) return { ok: false, message: "This reset link has expired or was already used. Request a new one below." };
  return { ok: true };
}
