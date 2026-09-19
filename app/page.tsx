"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins, LayoutGrid, List, WalletCards } from "lucide-react";
import { pointPacks, redeemCatalog } from "@/lib/catalog";

type Tab = "home" | "buy" | "redeem" | "activity";

const seed = [
  { title: "Renoxis Agent Office", meta: "Redeem", xp: -15000 },
  { title: "Office coins", meta: "Purchase", xp: 36000 },
  { title: "Renovation concept", meta: "Redeem", xp: -500 },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [paid, setPaid] = useState(40350);
  const [bonus, setBonus] = useState(2500);
  const [reserved] = useState(0);
  const [notice, setNotice] = useState("");
  const [log, setLog] = useState(seed);
  const available = paid + bonus;

  const buy = async (id: string) => {
    setNotice("Opening coin checkout…");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: id }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.url) window.location.assign(data.url);
    } catch {
      setNotice("Stripe is not connected. Coin checkout is the only card flow.");
    }
  };

  const redeem = async (key: string, name: string, xp: number) => {
    if (available < xp) {
      setNotice(`Need ${(xp - available).toLocaleString()} more XP.`);
      setTab("buy");
      return;
    }
    const fromBonus = Math.min(bonus, xp);
    const fromPaid = xp - fromBonus;
    setBonus((b) => b - fromBonus);
    setPaid((p) => p - fromPaid);
    setLog((rows) => [{ title: name, meta: "Redeem", xp: -xp }, ...rows]);
    setNotice(`${name} · ${xp.toLocaleString()} XP`);
    void fetch("/api/v1/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productKey: key }),
    });
  };

  const title = useMemo(
    () => ({ home: "Balance", buy: "Buy coins", redeem: "Redeem", activity: "Activity" })[tab],
    [tab],
  );

  return (
    <main>
      <aside>
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <strong>APIXIS</strong>
            <span>WALLET</span>
          </div>
        </div>
        <nav>
          <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><LayoutGrid />Home</button>
          <button className={tab === "buy" ? "active" : ""} onClick={() => setTab("buy")}><WalletCards />Buy</button>
          <button className={tab === "redeem" ? "active" : ""} onClick={() => setTab("redeem")}><Coins />Redeem</button>
          <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><List />Activity</button>
        </nav>
      </aside>
      <section className="shell">
        <header>
          <div>
            <p>100 XP = $1</p>
            <h1>{title}</h1>
          </div>
          <p style={{ color: "#8e99a5", fontSize: 13 }}>{available.toLocaleString()} XP</p>
        </header>
        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice}<span>×</span>
          </div>
        )}

        {tab === "home" && (
          <>
            <article className="balance-card">
              <div className="eyebrow"><span>AVAILABLE</span></div>
              <h2>{available.toLocaleString()} <small>XP</small></h2>
              <p>${(available / 100).toFixed(2)}</p>
              <div className="balance-actions">
                <button onClick={() => setTab("buy")}>Buy coins</button>
                <button className="secondary" onClick={() => setTab("redeem")}>Redeem</button>
              </div>
              <div className="split">
                <span><b>{paid.toLocaleString()} XP</b>Paid</span>
                <span><b>{bonus.toLocaleString()} XP</b>Bonus</span>
                <span><b>{reserved.toLocaleString()} XP</b>Held</span>
              </div>
            </article>
            <footer>One checkout. Coins only. Products redeem XP.</footer>
          </>
        )}

        {tab === "buy" && (
          <div className="packs">
            {pointPacks.map((p) => (
              <article key={p.id}>
                <p>{p.name}</p>
                <h3>{p.xp.toLocaleString()} <small>XP</small></h3>
                <span>${p.price}{p.bonus > 0 ? ` + ${p.bonus.toLocaleString()} bonus` : ""}</span>
                <button onClick={() => buy(p.id)}>Buy</button>
              </article>
            ))}
          </div>
        )}

        {tab === "redeem" && (
          <div className="products">
            {redeemCatalog.map((p) => (
              <article key={p.key} style={{ ["--accent"]: p.color } as React.CSSProperties}>
                <span>{p.app.slice(0, 1)}</span>
                <p>{p.app}</p>
                <h3>{p.name}</h3>
                <b>{p.xp.toLocaleString()} XP</b>
                <button onClick={() => redeem(p.key, p.name, p.xp)}>Redeem</button>
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
                <strong className={t.xp > 0 ? "green" : ""}>{t.xp > 0 ? "+" : ""}{t.xp.toLocaleString()} XP</strong>
              </div>
            ))}
          </article>
        )}
      </section>
    </main>
  );
}
