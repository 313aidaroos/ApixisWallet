import { safeLocalRedirect } from "@/lib/apixis-redirect";

/**
 * 2026-09-28 Grok Developer Bot: a magic link carries next=/set-password?next=<where they were going>.
 * Someone who already chose a password skips that screen and goes straight on (e.g. back to
 * /sso/authorize for Apixis ID), so sign-in from a product completes in one click.
 */
export function skipSetPassword(next: string, passwordSet: boolean): string {
  if (!passwordSet) return next;
  const url = new URL(next, "https://local.invalid");
  if (url.pathname !== "/set-password") return next;
  return safeLocalRedirect(url.searchParams.get("next"));
}
