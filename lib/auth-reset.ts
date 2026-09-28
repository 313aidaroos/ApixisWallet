import { safeLocalRedirect } from "@/lib/apixis-redirect";

/**
 * 2026-09-28 Grok Developer Bot: Apixis ID password reset.
 * The reset email (Supabase `recover`, implicit flow) lands on /set-password?reset=1&next=<path> with the
 * recovery session in the URL hash. Implicit (not PKCE) on purpose: the email can be opened in any
 * browser, and Apixis.dev requests resets server-side, so there is no code verifier to hold.
 */
export function resetRedirectUrl(appBase: string, next: unknown): string {
  const base = appBase.replace(/\/+$/, "");
  const url = new URL("/set-password", base || "https://apixis-wallet.vercel.app");
  url.searchParams.set("reset", "1");
  url.searchParams.set("next", safeLocalRedirect(next));
  return url.toString();
}

export type RecoveryHash =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/** Reads `#access_token=…&refresh_token=…&type=recovery` or `#error=…&error_description=…`. */
export function parseRecoveryHash(hash: string): RecoveryHash {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error_code") || params.get("error");
  if (error) {
    const expired = error === "otp_expired" || /expired|invalid/i.test(params.get("error_description") ?? "");
    return {
      kind: "error",
      message: expired
        ? "This reset link has expired or was already used. Request a new one below."
        : "This reset link did not work. Request a new one below.",
    };
  }
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken };
  return { kind: "none" };
}
