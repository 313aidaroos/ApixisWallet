import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 2026-09-28 Grok Developer Bot: shared frame for /login and /set-password.
 * Same brand mark, colours and type as the Wallet HQ (app/globals.css), plus a Cixy help card.
 */
export function AuthShell({ children, help }: { children: ReactNode; help?: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-top">
        <Link className="brand" href="/" aria-label="Apixis Wallet HQ">
          <div className="mark">A</div>
          <div>
            <strong>APIXIS</strong>
            <span>FAMILY // WALLET</span>
          </div>
        </Link>
        <div className="auth-nav" role="navigation" aria-label="Wallet">
          <Link href="/">HQ</Link>
          <Link href="/?tab=buy">Buy Ixis</Link>
          <a href="https://apixis.dev">Apixis.dev</a>
        </div>
      </div>
      <div className="auth-body">
        <section className="auth-card">{children}</section>
        {help ?? <CixyHelp />}
      </div>
      <p className="auth-foot">APIXIS FAMILY CO. · one Apixis ID for every family site · 100 Ixis = $1</p>
    </main>
  );
}

const FAQ = [
  {
    q: "What is Apixis ID?",
    a: "One account (email + password, or an email link) for Apixis Wallet, Apixis.dev and every Apixis company.",
  },
  {
    q: "I forgot my password",
    a: "Choose Password, then “Forgot password?”. We email a reset link (valid 1 hour). Pick a new password and you carry on where you were.",
  },
  {
    q: "How does the magic link work?",
    a: "Enter your email on Magic link. Open the one-time link we send on this device. First time? It creates your Apixis ID.",
  },
];

/** Not an <aside>: globals.css styles <aside> as the fixed HQ sidebar.
 *  The Wallet has no public Cixy chat yet: avatar + quick answers + a link to Cixy on Apixis.dev. */
export function CixyHelp() {
  return (
    <section className="auth-cixy" aria-labelledby="cixy-help-title">
      <div className="auth-cixy-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cixy/cixy-combo-a-avatar.webp" alt="Cixy, the Apixis AI guide" width={64} height={64} />
        <div>
          <p className="auth-eyebrow">CIXY · HELP</p>
          <h2 id="cixy-help-title">Need help signing in?</h2>
        </div>
      </div>
      {FAQ.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
      <a className="auth-ghost" href="https://apixis.dev/login#ask-cixy" target="_blank" rel="noopener noreferrer">
        Ask Cixy ↗
      </a>
    </section>
  );
}
