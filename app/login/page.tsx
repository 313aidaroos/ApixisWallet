"use client";

import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { AuthShell } from "@/components/AuthShell";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, magicLink, resetPassword, signup } from "./actions";

// 2026-09-28 Grok Developer Bot: "Log in with Apixis ID", Wallet header + Cixy help, Forgot password.
type Mode = "magic" | "password" | "signup" | "master" | "forgot";
const MODES: readonly Mode[] = ["magic", "password", "signup", "master", "forgot"];

const TITLES: Record<Mode, string> = {
  magic: "Log in with Apixis ID",
  password: "Log in with Apixis ID",
  signup: "Create your Apixis ID",
  master: "Master password",
  forgot: "Reset your password",
};

const LEDES: Record<Mode, string> = {
  magic: "One account for Apixis Wallet, Apixis.dev and every Apixis company.",
  password: "One account for Apixis Wallet, Apixis.dev and every Apixis company.",
  signup: "One Apixis ID works on every family site.",
  master: "Use awad@apixis.dev or alaidaroosawad@gmail.com and choose the password you want. Confirm the email before master access works.",
  forgot: "Enter your Apixis ID email. We will send a link to choose a new password.",
};

const SUBMIT: Record<Mode, string> = {
  magic: "Email me a sign-in link",
  password: "Log in with Apixis ID",
  signup: "Create account",
  master: "Save master password",
  forgot: "Email me a reset link",
};

function LoginPageInner() {
  const params = useSearchParams();
  const next = safeLocalRedirect(params.get("next"));
  const initial = params.get("mode");
  const [mode, setMode] = useState<Mode>(MODES.includes(initial as Mode) ? (initial as Mode) : "magic");
  const [notice, setNotice] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(mode === "master" ? "awad@apixis.dev" : "");

  function go(m: Mode) {
    setMode(m);
    setSent(false);
    setNotice(null);
    if (m === "master") setEmail("awad@apixis.dev");
  }

  const isTab = mode === "magic" || mode === "password";

  return (
    <AuthShell>
      <p className="auth-eyebrow">APIXIS ID</p>
      <h1>{sent && mode === "forgot" ? "Check your email" : TITLES[mode]}</h1>
      {!(sent && mode === "forgot") && <p className="auth-lede">{LEDES[mode]}</p>}
      {notice && (
        <div className={`auth-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      )}
      {isTab && (
        <div className="auth-tabs" role="tablist" aria-label="How to log in">
          <button type="button" role="tab" aria-selected={mode === "magic"} className={mode === "magic" ? "active" : ""} onClick={() => go("magic")}>
            Magic link
          </button>
          <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "active" : ""} onClick={() => go("password")}>
            Password
          </button>
        </div>
      )}
      {!sent && (
        <form
          className="auth-form"
          action={async (form) => {
            setBusy(true);
            try {
              const result =
                mode === "magic" ? await magicLink(form)
                  : mode === "password" ? await login(form)
                    : mode === "forgot" ? await resetPassword(form)
                      : await signup(form);
              if (result?.redirectTo) {
                // Full navigation: `next` is often /sso/authorize, which 302s back to the product.
                window.location.assign(safeLocalRedirect(result.redirectTo));
                return;
              }
              const r = (result ?? {}) as { message?: string; sent?: boolean };
              const message = r.message ?? "";
              const sentNow = mode === "magic" ? message.startsWith("Check ") : mode === "forgot" ? Boolean(r.sent) : false;
              const good = sentNow || /^(Account created|Master account)/.test(message);
              setNotice(message ? { text: message, kind: good ? "ok" : "error" } : null);
              if (sentNow) setSent(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input type="hidden" name="next" value={next} />
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" required autoComplete={mode === "password" ? "username" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {(mode === "password" || mode === "signup" || mode === "master") && (
            <>
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                minLength={mode === "password" ? undefined : 8}
                autoComplete={mode === "password" ? "current-password" : "new-password"}
                placeholder={mode === "password" ? "Your Apixis ID password" : "At least 8 characters"}
              />
            </>
          )}
          {mode === "password" && (
            <div className="auth-row">
              <button type="button" className="auth-link" onClick={() => go("forgot")}>Forgot password?</button>
            </div>
          )}
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? "One moment…" : SUBMIT[mode]}</button>
        </form>
      )}
      {sent && mode === "forgot" && (
        <p className="auth-lede">Open the link to choose a new password; you will carry on where you were. No email after a few minutes? Check spam, or try again.</p>
      )}
      <div className="auth-links">
        {mode === "forgot" || mode === "signup" || mode === "master" || sent ? (
          <button type="button" className="auth-link" onClick={() => go(mode === "forgot" ? "password" : "magic")}>← Back to log in</button>
        ) : (
          <button type="button" className="auth-link" onClick={() => go("signup")}>New here? Create an Apixis ID</button>
        )}
        {mode !== "master" && (
          <button type="button" className="auth-link muted" onClick={() => go("master")}>Master</button>
        )}
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
