"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, Coins, Gem, Grid2X2, Plus, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { pointPacks, products } from "@/lib/catalog";

const tx = [
  { title: "Renoxis Agent Office", meta: "Subscription · Sep 19", xp: -15000 },
  { title: "Office Pack", meta: "Points purchase · Sep 18", xp: 36000 },
  { title: "Renovation concept", meta: "Renoxis · Sep 18", xp: -500 },
  { title: "Launch reward", meta: "Promotional XP · Sep 17", xp: 2500 },
];

export default function Home() {
  const [balance, setBalance] = useState(42850);
  const [notice, setNotice] = useState("");
  const buy = async (id: string) => {
    setNotice("Opening secure checkout…");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId: id }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.url) window.location.assign(data.url);
    } catch { setNotice("Demo mode: connect Stripe variables to activate checkout."); }
  };
  const activate = (name: string, xp: number) => {
    if (balance < xp) return setNotice(`You need ${(xp - balance).toLocaleString()} more XP.`);
    setBalance((b) => b - xp); setNotice(`${name} activated in preview mode.`);
  };

  return <main>
    <aside>
      <div className="brand"><div className="mark">A</div><div><strong>APIXIS</strong><span>WALLET</span></div></div>
      <nav>
        <button className="active"><Grid2X2/>Overview</button><button><WalletCards/>Wallet</button><button><Coins/>Products</button><button><Sparkles/>Marketplace</button><button><ShieldCheck/>Security</button>
      </nav>
      <div className="cixy"><div className="orb">C</div><div><strong>Cixy</strong><p>Your wallet guide</p></div><i></i></div>
    </aside>
    <section className="shell">
      <header><div><p>APX ECOSYSTEM / WALLET</p><h1>Good evening, Awad.</h1></div><div className="header-actions"><button className="icon"><Bell/></button><button className="profile">AA</button></div></header>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></div>}
      <div className="hero-grid">
        <article className="balance-card"><div className="eyebrow"><span>UNIVERSAL BALANCE</span><span className="live">● LIVE</span></div><h2>{balance.toLocaleString()} <small>XP</small></h2><p>Equivalent purchasing power <b>${(balance / 100).toFixed(2)}</b></p><div className="balance-actions"><button onClick={() => document.getElementById("packs")?.scrollIntoView({behavior:"smooth"})}><Plus/>Add points</button><button className="secondary">Manage wallet</button></div><div className="split"><span><b>40,350 XP</b>Purchased</span><span><b>2,500 XP</b>Bonus</span><span><b>15,000 XP</b>Reserved</span></div></article>
        <article className="token-card"><div className="token-orbit"><Gem/></div><span>FUTURE BLOCKCHAIN LAYER</span><h3>APX Token</h3><p>Kept legally and technically separate from Xis Points until launch approval.</p><button disabled>Coming later</button></article>
      </div>
      <div className="section-title"><div><p>YOUR ECOSYSTEM</p><h2>Activate Apixis products</h2></div><button>View all apps →</button></div>
      <div className="products">{products.map((p) => <article key={p.app} style={{["--accent"]:p.color} as React.CSSProperties}><span>{p.app.slice(0,1)}</span><p>{p.app}</p><h3>{p.name}</h3><b>{p.xp.toLocaleString()} XP / mo</b><button onClick={() => activate(p.name, p.xp)}>Activate</button></article>)}</div>
      <div className="lower">
        <article className="transactions"><div className="section-title"><div><p>LEDGER</p><h2>Recent activity</h2></div><button>Full history →</button></div>{tx.map((t)=><div className="tx" key={t.title}><span className={t.xp>0?"in":"out"}>{t.xp>0?<ArrowDownLeft/>:<ArrowUpRight/>}</span><div><b>{t.title}</b><p>{t.meta}</p></div><strong className={t.xp>0?"green":""}>{t.xp>0?"+":""}{t.xp.toLocaleString()} XP</strong></div>)}</article>
        <article className="insight"><p>CIXY INSIGHT</p><h2>Your balance covers your Renoxis renewal and 5 renovation concepts.</h2><div className="meter"><i style={{width:"64%"}}></i></div><span>Next renewal: 15,000 XP on Oct 19</span><button>Review upcoming charges</button></article>
      </div>
      <div id="packs" className="section-title pack-title"><div><p>REFILL WALLET</p><h2>Choose a point pack</h2></div><span>100 XP = $1</span></div>
      <div className="packs">{pointPacks.map((p)=><article key={p.id}><p>{p.name}</p><h3>{p.xp.toLocaleString()} <small>XP</small></h3><span>${p.price}{p.bonus>0?` · includes ${p.bonus.toLocaleString()} bonus XP`:""}</span><button onClick={()=>buy(p.id)}>Buy securely</button></article>)}</div>
      <footer>Xis Points are closed-loop platform credits, not cryptocurrency, not withdrawable, and not an investment. Paid XP does not expire.</footer>
    </section>
  </main>;
}
