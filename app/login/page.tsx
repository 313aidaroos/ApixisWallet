"use client";

import { useState } from "react";
import { login, signup } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "master">("login");
  const [notice, setNotice] = useState("");

  return (
    <main style={{ display: "grid", placeItems: "center" }}>
      <section className="shell" style={{ maxWidth: 420, paddingTop: 80 }}>
        <p style={{ color: "#c8ff63", letterSpacing: 2, fontSize: 10, fontWeight: 700 }}>APIXIS WALLET</p>
        <h1 style={{ marginTop: 8 }}>{mode === "signup" ? "Create account" : mode === "master" ? "Master password" : "Sign in"}</h1>
        <p style={{ color: "#8e99a5", fontSize: 13 }}>
          {mode === "master"
            ? "Use awad@apixis.dev and choose the password you want."
            : "Same Apixis ID across products."}
        </p>
        {notice && <div className="notice">{notice}</div>}
        <form
          style={{ display: "grid", gap: 12, marginTop: 24 }}
          action={async (form) => {
            const result = mode === "login" ? await login(form) : await signup(form);
            setNotice(result.message);
          }}
        >
          <input
            name="email"
            type="email"
            required
            defaultValue={mode === "master" ? "awad@apixis.dev" : ""}
            placeholder="email"
            style={{ padding: 12, borderRadius: 8, border: "1px solid #272e36", background: "#11151a", color: "white" }}
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder={mode === "master" ? "new password (min 8)" : "password"}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #272e36", background: "#11151a", color: "white" }}
          />
          <button type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#c8ff63", fontWeight: 800 }}>
            {mode === "login" ? "Sign in" : mode === "master" ? "Save master password" : "Create account"}
          </button>
        </form>
        <div style={{ display: "flex", gap: 16, marginTop: 18, fontSize: 13 }}>
          <button onClick={() => setMode("login")} style={{ background: "none", border: 0, color: "#8e99a5" }}>Sign in</button>
          <button onClick={() => setMode("signup")} style={{ background: "none", border: 0, color: "#8e99a5" }}>Sign up</button>
          <button onClick={() => setMode("master")} style={{ background: "none", border: 0, color: "#c8ff63" }}>Master</button>
        </div>
      </section>
    </main>
  );
}
