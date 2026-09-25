"use client";

import { safeLocalRedirect } from "@/lib/apixis-redirect";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, magicLink, signup } from "./actions";

const field = { padding: 12, borderRadius: 8, border: "1px solid #272e36", background: "#11151a", color: "white" } as const;

function LoginPageInner() {
  const params = useSearchParams();
  const next = safeLocalRedirect(params.get("next"));
  const [mode, setMode] = useState<"magic" | "password" | "signup" | "master">("magic");
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <main style={{ display: "grid", placeItems: "center" }}>
      <section className="shell" style={{ maxWidth: 420, paddingTop: 80 }}>
        <p style={{ color: "#c8ff63", letterSpacing: 2, fontSize: 10, fontWeight: 700 }}>APIXIS WALLET</p>
        <h1 style={{ marginTop: 8 }}>
          {mode === "magic" ? "Sign in with a link" : mode === "signup" ? "Create account" : mode === "master" ? "Master password" : "Sign in with password"}
        </h1>
        <p style={{ color: "#8e99a5", fontSize: 13 }}>
          {mode === "magic"
            ? "Enter your email. We send a one-click link — no password needed. One Apixis ID works on every family site."
            : mode === "master"
              ? "Use awad@apixis.dev and choose the password you want."
              : "Same Apixis ID across products."}
        </p>
        {notice && <div className="notice" role="status">{notice}</div>}
        {!(mode === "magic" && sent) && (
          <form
            style={{ display: "grid", gap: 12, marginTop: 24 }}
            action={async (form) => {
              const result =
                mode === "magic" ? await magicLink(form) : mode === "password" ? await login(form) : await signup(form);
              setNotice(result?.message ?? "");
              if (mode === "magic" && result?.message?.startsWith("Check ")) setSent(true);
            }}
          >
            <input type="hidden" name="next" value={next} />
            <input name="email" type="email" required autoComplete="email" defaultValue={mode === "master" ? "awad@apixis.dev" : ""} placeholder="email" style={field} />
            {mode !== "magic" && (
              <input name="password" type="password" required minLength={8} autoComplete={mode === "password" ? "current-password" : "new-password"} placeholder={mode === "master" ? "new password (min 8)" : "password"} style={field} />
            )}
            <button type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#c8ff63", fontWeight: 800 }}>
              {mode === "magic" ? "Email me a sign-in link" : mode === "password" ? "Sign in" : mode === "master" ? "Save master password" : "Create account"}
            </button>
          </form>
        )}
        <div style={{ display: "flex", gap: 16, marginTop: 18, fontSize: 13, flexWrap: "wrap" }}>
          <button onClick={() => { setMode("magic"); setSent(false); setNotice(""); }} style={{ background: "none", border: 0, color: mode === "magic" ? "#c8ff63" : "#8e99a5" }}>Email link</button>
          <button onClick={() => { setMode("password"); setNotice(""); }} style={{ background: "none", border: 0, color: mode === "password" ? "#c8ff63" : "#8e99a5" }}>Password</button>
          <button onClick={() => { setMode("signup"); setNotice(""); }} style={{ background: "none", border: 0, color: "#8e99a5" }}>Sign up</button>
          <button onClick={() => { setMode("master"); setNotice(""); }} style={{ background: "none", border: 0, color: "#8e99a5" }}>Master</button>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
