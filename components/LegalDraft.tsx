import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_DRAFT_BANNER } from "@/lib/legal";

export function LegalDraft({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="ix-legal">
      <p className="ix-legal-kicker">Apixis Wallet · 100 Ixis = $1</p>
      <h1>{title}</h1>
      <p className="ix-legal-banner" role="note">
        {LEGAL_DRAFT_BANNER}
      </p>
      <article>{children}</article>
      <nav className="ix-legal-nav" aria-label="Legal">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refund">Refunds</Link>
        <Link href="/">Wallet</Link>
      </nav>
    </main>
  );
}
