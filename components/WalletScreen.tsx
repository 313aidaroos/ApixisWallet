"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Coins, LayoutGrid, List, Megaphone, ShoppingBag, TrendingUp, WalletCards } from "lucide-react";
import { pointPacks, redeemCatalog, shopCatalog, shopCategories, type ShopCategory } from "@/lib/catalog";
import { appSlug, resolveDestination } from "@/lib/checkout/destinations";
import { returnHost } from "@/lib/checkout/return-url";
import { last24h, productTape, xpTape } from "@/lib/market";
import { bulletins, ticker } from "@/lib/news";
import { Tape } from "@/components/Tape";

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

const seed = [
  { title: "Renoxis Agent Office", meta: "Redeem", xp: -30000 },
  { title: "Studio coins", meta: "Purchase", xp: 50000 },
  { title: "Image meter", meta: "Meter", xp: -150 },
];

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WalletScreen({ lockTab }: { lockTab?: Tab }) {
  const params = useSearchParams();
  const returnUrl = params.get("return_url") ?? params.get("returnUrl") ?? "";
  const product = params.get("product") ?? params.get("app") ?? params.get("destination") ?? "";
  const queryTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(lockTab ?? (isTab(queryTab) ? queryTab : "home"));
  const [paid, setPaid] = useState(40350);
  const [bonus] = useState(0);
  const [reserved] = useState(0);
  const [notice, setNotice] = useState(() => openingNotice(params.get("checkout")));
  const [log, setLog] = useState(seed);
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
      if (!response.ok) {
        setNotice(typeof data?.error === "string" ? data.error : "Stripe dark. Coin checkout is the only card flow.");
        return;
      }
      if (data?.url) window.location.assign(data.url);
    } catch {
      setNotice("Stripe dark. Coin checkout is the only card flow.");
    }
  };

  const redeem = async (key: string, name: string, xp: number, meta = "Redeem", extra = "") => {
    if (available < xp) {
      setNotice(`Need ${(xp - available).toLocaleString()} more Ixis.`);
      setTab("buy");
      return;
    }
    setPaid((p) => p - xp);
    setLog((rows) => [{ title: name, meta, xp: -xp }, ...rows]);
    setNotice(extra ? `${name} · ${xp.toLocaleString()} Ixis. ${extra}` : `${name} · ${xp.toLocaleString()} Ixis`);
    void fetch("/api/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productKey: key }),
    });
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
            <p>100 Ixis = $1 <span className="live">● LIVE</span></p>
            <h1>{title}</h1>
          </div>
          <p>{available.toLocaleString()} Ixis</p>
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
              <h2>{available.toLocaleString()} <small>Ixis</small></h2>
              <p>${(available / 100).toFixed(2)}</p>
              <div className="balance-actions">
                <button onClick={() => setTab("buy")}>Buy coins</button>
                <button className="secondary" onClick={() => setTab("redeem")}>Redeem</button>
              </div>
              <div className="split">
                <span><b>{paid.toLocaleString()} Ixis</b>Paid</span>
                <span><b>{bonus.toLocaleString()} Ixis</b>Bonus</span>
                <span><b>{reserved.toLocaleString()} Ixis</b>Held</span>
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
                <h3>{p.xp.toLocaleString()} <small>Ixis</small></h3>
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
                {destination.label} SKUs. Ixis stays in this Wallet until you redeem.
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
                <b>{p.xp.toLocaleString()} Ixis</b>
                <button onClick={() => redeem(p.key, p.name, p.xp)}>Redeem</button>
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
                    <b>{p.xp.toLocaleString()} Ixis</b>
                    <span>{usd(p.xp / 100)}</span>
                    <p>{p.blurb}</p>
                    <button
                      onClick={() =>
                        redeem(
                          p.key,
                          p.name,
                          p.xp,
                          "Shop",
                          p.category === "merch" ? "We'll fulfill when designs land." : "",
                        )
                      }
                    >
                      Buy with Ixis
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
              <div className="eyebrow"><span>Ixis / USD</span><span className="live">PEG $0.01</span></div>
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
                  <b>{p.volume30.toLocaleString()} Ixis / 30d</b>
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
                <strong className={t.xp > 0 ? "green" : ""}>{t.xp > 0 ? "+" : ""}{t.xp.toLocaleString()} Ixis</strong>
              </div>
            ))}
          </article>
        )}
        <footer>APIXIS FAMILY CO. · coins only · peg 100 Ixis = $1</footer>
      </section>
    </main>
  );
}
