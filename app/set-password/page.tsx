"use client";

import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { parseRecoveryHash } from "@/lib/auth-reset";
import { AuthShell } from "@/components/AuthShell";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { setPassword, startRecovery } from "@/app/login/actions";

/**
 * Choose a password: after a first magic-link sign-in, or (reset=1) from the "Forgot password?" email.
 * 2026-09-28 Grok Developer Bot: reset links carry the recovery session in the URL hash; it is turned into
 * the session cookie (startRecovery) before the form is shown. Wallet header + Cixy help (AuthShell).
 */
function SetPasswordPageInner() {
  const params = useSearchParams();
  const next = safeLocalRedirect(params.get("next"));
  const reset = params.get("reset") === "1";
  const [notice, setNotice] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "expired">(reset ? "checking" : "ready");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reset) return;
    let cancelled = false;
    const run = async () => {
      const parsed = parseRecoveryHash(window.location.hash);
      if (parsed.kind !== "none") {
        // Never leave tokens in the address bar or history.
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      const outcome = await (parsed.kind === "session"
        ? startRecovery(parsed.accessToken, parsed.refreshToken)
        : Promise.resolve(parsed.kind === "error" ? { ok: false, message: parsed.message } : { ok: true }));
      if (cancelled) return;
      if (outcome.ok) {
        setState("ready");
      } else {
        setNotice({ text: outcome.message ?? "This reset link did not work. Request a new one below.", kind: "error" });
        setState("expired");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const forgotHref = `/login?mode=forgot&next=${encodeURIComponent(next)}`;

  return (
    <AuthShell>
      <p className="auth-eyebrow">{reset ? "APIXIS ID · PASSWORD RESET" : "APIXIS ID · YOU ARE SIGNED IN"}</p>
      <h1>{reset ? "Choose a new password" : "Choose a password"}</h1>
      <p className="auth-lede">
        {reset
          ? "Pick a new password for your Apixis ID. It works on Apixis Wallet, Apixis.dev and every family site."
          : "Next time you can log in without waiting for an email. This password works on every Apixis family site."}
      </p>
      {notice && (
        <div className={`auth-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      )}
      {state === "checking" && <p className="auth-lede" role="status">Checking your reset link…</p>}
      {state === "expired" && (
        <div className="auth-form">
          <a className="auth-submit" href={forgotHref}>Email me a new reset link</a>
        </div>
      )}
      {state === "ready" && (
        <form
          className="auth-form"
          action={async (form) => {
            setBusy(true);
            try {
              const result = await setPassword(form);
              if (result?.redirectTo) {
                setNotice({ text: "Password saved. Taking you back…", kind: "ok" });
                // Full navigation so /sso/authorize can 302 back to the product.
                window.location.assign(safeLocalRedirect(result.redirectTo));
                return;
              }
              if (result?.message) {
                setNotice({ text: result.message, kind: "error" });
                if (/expired/i.test(result.message) && reset) setState("expired");
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <input type="hidden" name="next" value={next} />
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Saving…" : reset ? "Save new password and continue" : "Save password and continue"}
          </button>
        </form>
      )}
      {!reset && (
        <div className="auth-links">
          {/* Plain <a>: `next` may be /sso/authorize (route handler → sister site), not a page. */}
          <a className="auth-link" href={next}>Skip for now →</a>
        </div>
      )}
      {reset && state !== "checking" && (
        <div className="auth-links">
          <a className="auth-link" href={`/login?next=${encodeURIComponent(next)}`}>← Back to log in</a>
        </div>
      )}
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageInner />
    </Suspense>
  );
}
