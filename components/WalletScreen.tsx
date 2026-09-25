"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Coins, LayoutGrid, List, Megaphone, ShoppingBag, TrendingUp, WalletCards } from "lucide-react";
import { pointPacks, redeemCatalog, shopCatalog, shopCategories, type ShopCategory } from "@/lib/catalog";
import { appSlug, resolveDestination } from "@/lib/checkout/destinations";
import { returnHost } from "@/lib/checkout/return-url";
import { last24h, productTape, xpTape } from "@/lib/market";
import { bulletins, ticker } from "@/lib/news";
import { Tape } from "@/components/Tape";
import { fetchBalance, fetchHistory, redeemProduct, WalletClientError, type HistoryItem } from "@/lib/wallet-client";

type Tab = "home" | "buy" | "redeem" | "shop" | "market" | "news" | "activity";
type ShopFilter = "all" | ShopCategory;

const TABS: readonly Tab[] = ["home", "buy", "redeem", "shop", "market", "news", "activity"];

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

function readableHost(raw: string) {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function openingNotice(checkout: string | null) {
  if (checkout === "cancelled") return "Checkout cancelled. You can buy a pack whenever you are ready.";
  if (checkout === "success") return "Stripe returned you here. Paid Ixis posts to this Wallet after the webhook.";
  return "";
}

type LogRow = { title: string; meta: string; xp: number };

const KIND_LABEL: Record<string, string> = {
  purchase: "Purchase",
  bonus: "Bonus",
  spend: "Redeem",
  refund: "Refund",
  adjustment: "Adjustment",
};

/** Ledger receipts → activity rows. Holds and releases are internal steps; the spend is the redeem. */
function toLogRows(items: HistoryItem[]): LogRow[] {
  return items
    .filter((item) => item.kind !== "reserve" && item.kind !== "release")
    .map((item) => ({
      title: item.description,
      meta: [KIND_LABEL[item.kind] ?? item.kind, item.app].filter(Boolean).join(" · "),
      xp: item.kind === "spend" ? item.held : item.amount,
    }));
}

function signInHere() {
  const here = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WalletScreen({ lockTab, unitLabel = "Ixis" }: { lockTab?: Tab; unitLabel?: string }) {
  const unit = unitLabel === "Ixis Coin" ? "Ixis Coin" : "Ixis";
  const params = useSearchParams();
  const returnUrl = params.get("return_url") ?? params.get("returnUrl") ?? "";
  const product = params.get("product") ?? params.get("app") ?? params.get("destination") ?? "";
  const queryTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(lockTab ?? (isTab(queryTab) ? queryTab : "home"));
  const [paid, setPaid] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [notice, setNotice] = useState(() => openingNotice(params.get("checkout")));
  const [log, setLog] = useState<LogRow[]>([]);
  const [shopFilter, setShopFilter] = useState<ShopFilter>("all");
  const [showAllRedeem, setShowAllRedeem] = useState(false);
  const available = paid + bonus;
  const tape = last24h(xpTape);
  const destination = resolveDestination(product);
  const allowedReturnHost = returnUrl ? returnHost(returnUrl) : null;
  const shownReturnHost = returnUrl ? readableHost(returnUrl) : null;
  const scopedRedeem = destination && destination.slug !== "wallet" && !showAllRedeem
    ? redeemCatalog.filter((item) => appSlug(item.app) === destination.slug)
    : redeemCatalog;
  const redeemItems = scopedRedeem.length ? scopedRedeem : redeemCatalog;

  /** Balance and receipts come only from the Wallet ledger. Nothing is computed in the browser. */
  const refresh = useCallback(async () => {
    try {
      const [balance, history] = await Promise.all([fetchBalance(), fetchHistory({ limit: 50 })]);
      setPaid(balance.paid);
      setBonus(balance.bonus);
      setReserved(balance.reserved);
      setLog(toLogRows(history.transactions));
      setSignedIn(true);
    } catch (error) {
      if (error instanceof WalletClientError && error.needsSignIn) {
        setSignedIn(false);
        setNotice((current) => current || `Sign in to see your ${unit} balance.`);
        return;
      }
      setNotice("Wallet is unreachable right now. Your balance is safe; try again in a moment.");
    }
  }, [unit]);

  useEffect(() => {
    // Fetch-on-mount: the ledger is the only source of the balance.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const buy = async (id: string) => {
    setNotice("Opening coin checkout…");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packId: id,
          ...(returnUrl ? { return_url: returnUrl } : {}),
          ...(product ? { product } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        // Not signed in: go through magic link (and first-time password), then come straight back here.
        signInHere();
        return;
      }
      if (!response.ok) {
        setNotice(typeof data?.error === "string" ? data.error : "Stripe dark. Coin checkout is the only card flow.");
        return;
      }
      if (data?.url) window.location.assign(data.url);
    } catch {
      setNotice("Stripe dark. Coin checkout is the only card flow.");
    }
  };

  const redeem = async (key: string, name: string, xp: number, extra = "") => {
    if (signedIn === false) {
      signInHere();
      return;
    }
    if (redeeming) return;
    if (available < xp) {
      setNotice(`Need ${(xp - available).toLocaleString()} more ${unit}.`);
      setTab("buy");
      return;
    }
    setRedeeming(key);
    setNotice(`Redeeming ${name}…`);
    try {
      const result = await redeemProduct(key);
      if (result.ok) {
        setNotice(extra ? `${name} · ${xp.toLocaleString()} ${unit}. ${extra}` : `${name} · ${xp.toLocaleString()} ${unit}. Done.`);
      } else if (result.reason === "signin") {
        signInHere();
        return;
      } else if (result.reason === "insufficient") {
        setNotice(`Not enough ${unit} for ${name}. Buy a pack first.`);
        setTab("buy");
      } else {
        setNotice(result.message);
      }
    } catch {
      setNotice("Wallet is unreachable right now. Nothing was charged; try again in a moment.");
    } finally {
      setRedeeming(null);
      await refresh();
    }
  };

  const shopItems = shopFilter === "all" ? shopCatalog : shopCatalog.filter((item) => item.category === shopFilter);

  const title = useMemo(
    () => ({ home: "HQ", buy: "BUY", redeem: "REDEEM", shop: "SHOP", market: "TAPE", news: "NEWS", activity: "LOG" })[tab],
    [tab],
  );

  return (
    <main>
      <aside>
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <strong>APIXIS</strong>
            <span>FAMILY // WALLET</span>
          </div>
        </div>
        <nav>
          <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><LayoutGrid />HQ</button>
          <button className={tab === "buy" ? "active" : ""} onClick={() => setTab("buy")}><WalletCards />Buy</button>
          <button className={tab === "redeem" ? "active" : ""} onClick={() => setTab("redeem")}><Coins />Redeem</button>
          <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}><ShoppingBag />Shop</button>
          <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}><TrendingUp />Tape</button>
          <button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}><Megaphone />News</button>
          <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><List />Log</button>
        </nav>
      </aside>
      <section className="shell">
        <div className="ticker"><i>{ticker}    {/* ///    {ticker} */}</i></div>
        <header>
          <div>
            <p>100 {unit} = $1 <span className="live">● LIVE</span></p>
            <h1>{title}</h1>
          </div>
          <p>{available.toLocaleString()} {unit}</p>
        </header>
        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice}<span>×</span>
          </div>
        )}

        {tab === "home" && (
          <div className="dash">
            <article className="balance-card">
              <div className="eyebrow"><span>AVAILABLE</span></div>
              <h2>{available.toLocaleString()} <small>{unit}</small></h2>
              <p>${(available / 100).toFixed(2)}</p>
              <div className="balance-actions">
                <button onClick={() => setTab("buy")}>Buy coins</button>
                <button className="secondary" onClick={() => setTab("redeem")}>Redeem</button>
              </div>
              <div className="split">
                <span><b>{paid.toLocaleString()} {unit}</b>Paid</span>
                <span><b>{bonus.toLocaleString()} {unit}</b>Bonus</span>
                <span><b>{reserved.toLocaleString()} {unit}</b>Held</span>
              </div>
              <div style={{ marginTop: 16 }}>
                <Tape values={xpTape.map((d) => d.circulating)} bars={xpTape.map((d) => d.buyXp + d.redeemXp)} height={120} />
              </div>
            </article>
            <div>
              <article className="transactions">
                {log.slice(0, 4).map((t, i) => (
                  <div className="tx" key={`${t.title}-${i}`}>
                    <span className={t.xp > 0 ? "in" : "out"}>{t.xp > 0 ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
                    <div><b>{t.title}</b><p>{t.meta}</p></div>
                    <strong className={t.xp > 0 ? "green" : ""}>{t.xp > 0 ? "+" : ""}{t.xp.toLocaleString()}</strong>
                  </div>
                ))}
              </article>
              <article className="news-card" style={{ marginTop: 14 }}>
                <em>{bulletins[0].tag} · {bulletins[0].source}</em>
                <h3>{bulletins[0].title}</h3>
                <p>{bulletins[0].body}</p>
                <button className="secondary" onClick={() => setTab("news")} style={{ marginTop: 10, background: "transparent", color: "#9dff4a", border: "1px solid #1f3a24", padding: "8px 10px" }}>All news</button>
              </article>
            </div>
          </div>
        )}

        {tab === "buy" && (
          <>
            {(returnUrl || product) && (
              <div className="notice">
                <span>
                  {returnUrl
                    ? allowedReturnHost
                      ? `After payment you return to ${allowedReturnHost}.`
                      : `Return host ${shownReturnHost ?? "is unreadable"}. Wallet checks it against the Apixis allowlist when you buy.`
                    : ""}
                  {product
                    ? destination
                      ? ` Sister app: ${destination.label}.`
                      : " That product is not a known Apixis app."
                    : ""}
                </span>
              </div>
            )}
            <div className="packs">
            {pointPacks.map((p) => (
              <article key={p.id}>
                <p>{p.name}</p>
                <h3>{p.xp.toLocaleString()} <small>{unit}</small></h3>
                <span>${p.price}</span>
                <button onClick={() => buy(p.id)}>Buy</button>
              </article>
            ))}
            </div>
          </>
        )}

        {tab === "redeem" && (
          <div className="products">
            {destination && destination.slug !== "wallet" && (
              <div style={{ gridColumn: "1 / -1", color: "var(--muted)", margin: 0 }}>
                {destination.label} SKUs. {unit} stays in this Wallet until you redeem.
                <button type="button" style={{ marginLeft: 10, background: "transparent", color: "#9dff4a", border: "1px solid #1f3a24", padding: "8px 10px" }} onClick={() => setShowAllRedeem((value) => !value)}>
                  {showAllRedeem ? destination.label : "All products"}
                </button>
              </div>
            )}
            {redeemItems.map((p) => (
              <article key={p.key} style={{ ["--accent"]: p.color } as React.CSSProperties}>
                <span>{p.app.slice(0, 1)}</span>
                <p>{p.app}</p>
                <h3>{p.name}</h3>
                <b>{p.xp.toLocaleString()} {unit}</b>
                <button disabled={redeeming === p.key} onClick={() => redeem(p.key, p.name, p.xp)}>Redeem</button>
              </article>
            ))}
          </div>
        )}

        {tab === "shop" && (
          <>
            <div className="balance-actions" style={{ flexWrap: "wrap" }}>
              <button className={shopFilter === "all" ? "" : "secondary"} onClick={() => setShopFilter("all")}>All</button>
              {shopCategories.map((category) => (
                <button
                  key={category.id}
                  className={shopFilter === category.id ? "" : "secondary"}
                  onClick={() => setShopFilter(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="products">
              {shopItems.map((p) => {
                const label = shopCategories.find((category) => category.id === p.category)?.label ?? "";
                return (
                  <article key={p.key} style={{ ["--accent"]: p.color } as React.CSSProperties}>
                    <span>{label.slice(0, 1)}</span>
                    <p>{label}</p>
                    <h3>{p.name}</h3>
                    <b>{p.xp.toLocaleString()} {unit}</b>
                    <span>{usd(p.xp / 100)}</span>
                    <p>{p.blurb}</p>
                    <button disabled={redeeming === p.key} onClick={() => redeem(p.key, p.name, p.xp)}>
                      Buy with {unit}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === "market" && (
          <>
            <article className="balance-card">
              <div className="eyebrow"><span>{unit} / USD</span><span className="live">PEG $0.01</span></div>
              <h2>$0.01 <small>FIXED</small></h2>
              <div className="split">
                <span><b>{tape.circulating.toLocaleString()}</b>Circulating</span>
                <span><b>{usd(tape.capUsd)}</b>Cap</span>
                <span><b>{usd(tape.volumeUsd)}</b>24h vol</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <Tape values={xpTape.map((d) => d.circulating)} bars={xpTape.map((d) => d.buyXp + d.redeemXp)} height={160} />
              </div>
            </article>
            <div className="products" style={{ marginTop: 14 }}>
              {productTape.map((p) => (
                <article key={p.key} style={{ ["--accent"]: p.color } as React.CSSProperties}>
                  <p>{p.symbol}</p>
                  <h3>{p.name}</h3>
                  <b>{p.volume30.toLocaleString()} {unit} / 30d</b>
                  <Tape values={p.redeemXp} color={p.color} height={72} />
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "news" && (
          <div>
            {bulletins.map((b) => (
              <article className="news-card" key={b.id}>
                <em>{b.tag} · {b.source} · {b.at}</em>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "activity" && (
          <article className="transactions">
            {log.map((t, i) => (
              <div className="tx" key={`${t.title}-${i}`}>
                <span className={t.xp > 0 ? "in" : "out"}>{t.xp > 0 ? <ArrowDownLeft /> : <ArrowUpRight />}</span>
                <div><b>{t.title}</b><p>{t.meta}</p></div>
                <strong className={t.xp > 0 ? "green" : ""}>{t.xp > 0 ? "+" : ""}{t.xp.toLocaleString()} {unit}</strong>
              </div>
            ))}
          </article>
        )}
        <footer>APIXIS FAMILY CO. · coins only · peg 100 {unit} = $1</footer>
      </section>
    </main>
  );
}
