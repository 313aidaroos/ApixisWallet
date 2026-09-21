"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { destinationChoices, productsForDestination } from "@/lib/checkout/destinations";

type PublicStatus = {
  status: "pending" | "credited" | "expired";
  next: "wait" | "redirect" | "choose";
  pack: { id: string; name: string; ixis: number } | null;
  destinationApp: string | null;
  destinationLabel: string | null;
  returnHost: string | null;
  ledgerUnreachable: boolean;
};

type Phase = { kind: "loading" } | { kind: "signin" } | { kind: "error"; message: string } | { kind: "ready"; status: PublicStatus };

const choices = destinationChoices();

const dollars = (ixis: number) =>
  (ixis / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

export function CheckoutSuccess() {
  const params = useSearchParams();
  const sessionId = params.get("session_id")?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [stay, setStay] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer = 0;
    let tries = 0;

    const tick = async () => {
      tries += 1;
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | PublicStatus | null;
        if (cancelled) return;
        if (response.status === 401) {
          setPhase({ kind: "signin" });
          return;
        }
        if (!response.ok || !data || !("status" in data)) {
          const message = data && "error" in data && typeof data.error === "string" ? data.error : "Could not read this checkout.";
          setPhase({ kind: "error", message });
          if (response.status >= 500 && tries < 20) timer = window.setTimeout(() => void tick(), 2000);
          return;
        }
        setPhase({ kind: "ready", status: data });
        if (data.status === "pending" && tries < 20) timer = window.setTimeout(() => void tick(), 2000);
        else if (data.status === "pending") setStalled(true);
      } catch {
        if (!cancelled) setPhase({ kind: "error", message: "Could not reach the wallet." });
      }
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, nonce]);

  useEffect(() => {
    if (stay || phase.kind !== "ready" || phase.status.next !== "redirect" || !sessionId) return;
    const timer = window.setTimeout(() => {
      // Full navigation so the route can 302 to the allowlisted sister host.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/checkout/return?session_id=${encodeURIComponent(sessionId)}`);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [stay, phase, sessionId]);

  const suggested = phase.kind === "ready" ? (phase.status.destinationApp ?? "wallet") : "wallet";
  const selected = selectedOverride ?? suggested;
  const confirmedChoice = choices.find((choice) => choice.slug === confirmed) ?? null;
  const confirmedProducts = confirmed && confirmed !== "wallet" ? productsForDestination(confirmed) : [];

  return (
    <main>
      <section className="shell solo">
        <header>
          <div>
            <p>100 Ixis = $1</p>
            <h1>AFTER PAY</h1>
          </div>
        </header>

        {!sessionId ? (
          <article className="balance-card">
            <h2>Receipt missing</h2>
            <p>This page needs the checkout session Stripe adds to the return link. If you already paid, Ixis still posts to your paid Wallet balance. Do not buy the pack again.</p>
            <div className="balance-actions">
              <Link className="go" href="/">Wallet</Link>
              <Link className="go" href="/buy">Buy</Link>
            </div>
          </article>
        ) : null}

        {sessionId && phase.kind === "loading" ? (
          <article className="balance-card">
            <p className="live">Checking payment…</p>
          </article>
        ) : null}

        {phase.kind === "signin" ? (
          <article className="balance-card">
            <h2>Sign in</h2>
            <p>Sign in with the same Apixis account you used at checkout. The webhook still credits that account. This page only shows where the Ixis landed.</p>
            <div className="balance-actions">
              <Link className="go" href="/login">Sign in</Link>
            </div>
          </article>
        ) : null}

        {phase.kind === "error" ? (
          <article className="balance-card">
            <h2>Checkout</h2>
            <p>{phase.message}</p>
            <div className="balance-actions">
              <button type="button" onClick={() => { setStalled(false); setNonce((value) => value + 1); }}>Check again</button>
              <Link className="go" href="/">Wallet</Link>
            </div>
          </article>
        ) : null}

        {phase.kind === "ready" ? (
          <article className="balance-card">
            {phase.status.pack ? (
              <>
                <div className="eyebrow"><span>{phase.status.pack.name.toUpperCase()}</span></div>
                <h2>{phase.status.pack.ixis.toLocaleString()} <small>Ixis</small></h2>
                <p>{dollars(phase.status.pack.ixis)} · 100 Ixis = $1</p>
              </>
            ) : (
              <h2>Checkout</h2>
            )}

            {phase.status.status === "expired" ? <p>This checkout expired before payment.</p> : null}

            {phase.status.status === "pending" ? (
              <>
                <p className="live">{stalled ? "Still waiting on the ledger." : "Waiting for the ledger…"}</p>
                <p>Stripe is the cashier. This page waits until the webhook credits your paid balance. It does not add Ixis from the browser.</p>
                {phase.status.returnHost ? <p>After the credit you return to {phase.status.returnHost}.</p> : null}
                {phase.status.ledgerUnreachable ? <p>The ledger check is unreachable. The webhook can still credit you. Check again in a moment.</p> : null}
                {stalled ? (
                  <div className="balance-actions">
                    <button type="button" onClick={() => { setStalled(false); setNonce((value) => value + 1); }}>Check again</button>
                  </div>
                ) : null}
              </>
            ) : null}

            {phase.status.status === "credited" && phase.status.next === "redirect" && !stay ? (
              <>
                <p>Paid Ixis is in your Apixis Wallet. Sending you back to {phase.status.returnHost ?? "the site you came from"}.</p>
                <div className="balance-actions">
                  <a className="go" href={`/api/checkout/return?session_id=${encodeURIComponent(sessionId)}`}>Continue</a>
                  <button type="button" className="secondary" onClick={() => setStay(true)}>Stay in Apixis Wallet</button>
                </div>
              </>
            ) : null}

            {phase.status.status === "credited" && (phase.status.next === "choose" || stay) ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setConfirmed(selected);
                }}
              >
                <p>Paid Ixis is in your Apixis Wallet. Choose where you want to use it, then confirm.</p>
                <fieldset className="choice-list">
                  <legend>Where should this Ixis land?</legend>
                  {choices.map((choice) => (
                    <label key={choice.slug}>
                      <input
                        type="radio"
                        name="destination"
                        value={choice.slug}
                        checked={selected === choice.slug}
                        onChange={() => {
                          setSelectedOverride(choice.slug);
                          setConfirmed(null);
                        }}
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="balance-actions">
                  <button type="submit">Confirm</button>
                </div>
              </form>
            ) : null}

            {confirmedChoice?.slug === "wallet" ? (
              <>
                <p>These Ixis stay in your Apixis Wallet paid balance.</p>
                <div className="balance-actions">
                  <Link className="go" href="/">Open Wallet</Link>
                </div>
              </>
            ) : null}

            {confirmedChoice && confirmedChoice.slug !== "wallet" ? (
              <p>
                {confirmedChoice.label} does not keep a separate Ixis balance. Nothing was moved. The pack stays in your Apixis Wallet paid balance. Redeem a {confirmedChoice.label} SKU when you want to spend it.
              </p>
            ) : null}
          </article>
        ) : null}

        {confirmedProducts.length > 0 ? (
          <div className="products" style={{ marginTop: 14 }}>
            {confirmedProducts.map((item) => (
              <article key={item.key} style={{ ["--accent"]: item.color } as React.CSSProperties}>
                <p>{item.app}</p>
                <h3>{item.name}</h3>
                <b>{item.xp.toLocaleString()} Ixis</b>
                <span>{dollars(item.xp)}</span>
                <Link className="go" href={`/?tab=redeem&product=${encodeURIComponent(confirmed ?? "")}`}>Redeem</Link>
              </article>
            ))}
          </div>
        ) : null}

        <footer>APIXIS FAMILY CO. · coins only · peg 100 Ixis = $1</footer>
      </section>
    </main>
  );
}
