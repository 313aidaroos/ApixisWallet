"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, Coins, Gem, Grid2X2, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { pointPacks, redeemCatalog } from "@/lib/catalog";

const tx = [
  { title: "Renoxis Agent Office", meta: "Redeemed · Sep 19", xp: -15000 },
  { title: "Office coins", meta: "Coin purchase · Sep 18", xp: 36000 },
  { title: "Renovation concept", meta: "Redeemed · Sep 18", xp: -500 },
  { title: "Launch reward", meta: "Bonus coins · Sep 17", xp: 2500 },
];

export default function Home() {
  const [balance, setBalance] = useState(42850);
  const [notice, setNotice] = useState("");
  const buy = async (id: string) => {
    setNotice("Opening the only checkout in Apixis — coin packs.");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId: id }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.url) window.location.assign(data.url);
    } catch { setNotice("Demo mode: connect Stripe to sell coins. Products never take a card."); }
  };
  const redeem = async (key: string, name: string, xp: number) => {
    if (balance < xp) return setNotice(`You need ${(xp - balance).toLocaleString()} more coins. Buy a pack below.`);
    setNotice(`Quoting ${name}…`);
    try {
      const quote = await fetch("/api/v1/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productKey: key }) });
      const data = await quote.json();
      if (!quote.ok) throw new Error();
      setBalance((b) => b - xp);
      setNotice(`Redeemed ${name} for ${data.xp.toLocaleString()} XP ($${(data.xp / 100).toFixed(0)}). No second checkout.`);
    } catch {
      setBalance((b) => b - xp);
      setNotice(`${name} redeemed in preview. Live redeem waits on the ledger.`);
    }
  };

  return <main>
    <aside>
      <div className="brand"><div className="mark">A</div><div><strong>APIXIS</strong><span>WALLET</span></div></div>
      <nav>
        <button className="active"><Grid2X2/>Overview</button><button><WalletCards/>Wallet</button><button><Coins/>Redeem</button><button><Sparkles/>Marketplace</button><button><ShieldCheck/>Security</button>
      </nav>
      <div className="cixy"><div className="orb">C</div><div><strong>Cixy</strong><p>Buy coins. Spend anywhere.</p></div><i></i></div>
    </aside>
    <section className="shell">
      <header><div><p>ONE STORE / ONE BALANCE</p><h1>Buy coins. Redeem the empire.</h1></div><div className="header-actions"><button className="icon"><Bell/></button><button className="profile">AA</button></div></header>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></div>}
      <div className="hero-grid">
        <article className="balance-card"><div className="eyebrow"><span>UNIVERSAL COINS</span><span className="live">● LIVE</span></div><h2>{balance.toLocaleString()} <small>XP</small></h2><p>Purchasing power <b>${(balance / 100).toFixed(2)}</b> · 100 XP = $1</p><div className="balance-actions"><button onClick={() => document.getElementById("packs")?.scrollIntoView({behavior:"smooth"})}><Plus/>Buy coins</button><button className="secondary">No other checkout</button></div><div className="split"><span><b>40,350 XP</b>Purchased</span><span><b>2,500 XP</b>Bonus</span><span><b>15,000 XP</b>Reserved</span></div></article>
        <article className="token-card"><div className="token-orbit"><Gem/></div><span>NOT FOR SALE HERE</span><h3>APX Token</h3><p>Not a buy option. Separate future asset. Coins never convert into APX.</p><button disabled>Not a checkout</button></article>
      </div>
      <div className="section-title"><div><p>REDEEM</p><h2>Spend coins on products</h2></div><span>These buttons never take a card</span></div>
      <div className="products">{redeemCatalog.map((p) => <article key={p.key} style={{["--accent"]:p.color} as React.CSSProperties}><span>{p.app.slice(0,1)}</span><p>{p.app}</p><h3>{p.name}</h3><b>{p.xp.toLocaleString()} XP · ${(p.xp / 100).toFixed(0)}</b><button onClick={() => redeem(p.key, p.name, p.xp)}>Redeem</button></article>)}</div>
      <div className="lower">
        <article className="transactions"><div className="section-title"><div><p>LEDGER</p><h2>Buys and redeems</h2></div><button>Full history →</button></div>{tx.map((t)=><div className="tx" key={t.title}><span className={t.xp>0?"in":"out"}>{t.xp>0?<ArrowDownLeft/>:<ArrowUpRight/>}</span><div><b>{t.title}</b><p>{t.meta}</p></div><strong className={t.xp>0?"green":""}>{t.xp>0?"+":""}{t.xp.toLocaleString()} XP</strong></div>)}</article>
        <article className="insight"><p>CIXY INSIGHT</p><h2>Card payments happen only on coin packs. Every app just burns XP.</h2><div className="meter"><i style={{width:"64%"}}></i></div><span>Next redeem: Renoxis 15,000 XP</span><button onClick={() => document.getElementById("packs")?.scrollIntoView({behavior:"smooth"})}>Need coins? Buy a pack</button></article>
      </div>
      <div id="packs" className="section-title pack-title"><div><p>THE ONLY CHECKOUT</p><h2>Buy Xis Point coins</h2></div><span>100 XP = $1</span></div>
      <div className="packs">{pointPacks.map((p)=><article key={p.id}><p>{p.name}</p><h3>{p.xp.toLocaleString()} <small>XP</small></h3><span>${p.price}{p.bonus>0?` · +${p.bonus.toLocaleString()} bonus`:""}</span><button onClick={()=>buy(p.id)}>Buy coins</button></article>)}</div>
      <footer>Buy coins here. Redeem them on any Apixis product. XP is not cryptocurrency, not withdrawable, and not an investment.</footer>
    </section>
  </main>;
}
