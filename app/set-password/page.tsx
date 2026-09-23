"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { setPassword } from "@/app/login/actions";

function SetPasswordPageInner() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [notice, setNotice] = useState("");

  return (
    <main style={{ display: "grid", placeItems: "center" }}>
      <section className="shell" style={{ maxWidth: 420, paddingTop: 80 }}>
        <p style={{ color: "#c8ff63", letterSpacing: 2, fontSize: 10, fontWeight: 700 }}>APIXIS WALLET · YOU ARE SIGNED IN</p>
        <h1 style={{ marginTop: 8 }}>Choose a password</h1>
        <p style={{ color: "#8e99a5", fontSize: 13 }}>
          Next time you can sign in without waiting for an email. This password works on every Apixis family site.
        </p>
        {notice && <div className="notice" role="alert">{notice}</div>}
        <form
          style={{ display: "grid", gap: 12, marginTop: 24 }}
          action={async (form) => {
            const result = await setPassword(form);
            if (result?.message) setNotice(result.message);
          }}
        >
          <input type="hidden" name="next" value={next} />
          <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="new password (min 8)" style={{ padding: 12, borderRadius: 8, border: "1px solid #272e36", background: "#11151a", color: "white" }} />
          <button type="submit" style={{ padding: 12, border: 0, borderRadius: 8, background: "#c8ff63", fontWeight: 800 }}>Save password and continue</button>
        </form>
        <p style={{ marginTop: 18, fontSize: 13 }}>
          <Link href={next} style={{ color: "#8e99a5" }}>Skip for now →</Link>
        </p>
      </section>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageInner />
    </Suspense>
  );
}
