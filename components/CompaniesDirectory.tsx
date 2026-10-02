import type { CSSProperties } from "react";


const companies = [
  { name: "Apixis", url: "https://www.apixis.dev", description: "Virtual world and economy for AI agents.", kind: "globe", color: "#d7ad64", path: "M24 8a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm-16 16h32M24 8c-5 5-7 10-7 16s2 11 7 16m0-32c5 5 7 10 7 16s-2 11-7 16" },
  { name: "Apixis Wallet", url: "https://apixis-wallet.vercel.app", description: "Your Ixis wallet. Buy, hold, spend across every company.", kind: "wallet", color: "#e0b35c", path: "M6 15h34v25H6zM6 15V9h28v6m0 10h10v9H34a4 4 0 0 1 0-9Zm4 4h1" },
  { name: "Socixis", url: "https://socixis.dev", description: "Your own personal marketer, automated posts and advertisements.", kind: "social", color: "#bd83e6", path: "M8 12h32v23H22l-8 7v-7H8zM16 21h16M16 27h10m12-12 3-6m-9 4 2-8" },
  { name: "Lyrixis", url: "https://lyrixis.vercel.app", description: "Voice and media/music metadata.", kind: "music", color: "#a998ff", path: "M18 33V13l20-4v20M18 33c-3-2-8-1-8 3s5 5 8 2m20-9c-3-2-8-1-8 3s5 5 8 2M18 20l20-4" },
  { name: "Pinixis", url: "https://pinixis.vercel.app", description: "Collectible marketplace and arcade.", kind: "arcade", color: "#ffbd55", path: "M10 17h28l5 21H5zM18 24v10m-5-5h10m11-4h.1m-3 7h.1M16 17l3-8h10l3 8" },
  { name: "Renoxis", url: "https://renoxis.dev", description: "Your real estate AI. Deals, clients, commissions on autopilot.", kind: "home", color: "#63cfab", path: "M5 24 24 8l19 16M10 22v20h28V22M19 42V29h10v13m-15-21 10-8 10 8" },
  { name: "Contraxis", url: "https://contraxis-dev.vercel.app", description: "The everything-marketplace. Find pros for any job.", kind: "tools", color: "#eea46c", path: "M11 36 34 13m-21-2 6 6m17 19-6-6M9 31l8 8m-3-29 8 8m18 13-8 8M29 11l8 8" },
  { name: "Deduxis", url: "https://deduxis.vercel.app", description: "Snap a receipt. AI extracts, categorizes, exports your taxes.", kind: "receipt", color: "#8bdbca", path: "M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3zM18 17h12M18 24h12M18 31h7" },
  { name: "Rawixis", url: "https://rawixis.vercel.app", description: "B2B market for critical raw materials.", kind: "crystal", color: "#d6b476", path: "m24 6 16 16-16 20L8 22 24 6Zm-16 16h32M24 6l-6 16 6 20 6-20-6-16Z" },
  { name: "Halaxis", url: "https://halaxis.vercel.app", description: "Sharia-compliant hedge fund.", kind: "arch", color: "#c78d9e", path: "M10 41V24c0-12 14-18 14-18s14 6 14 18v17M10 41h28M18 41V26c0-5 6-9 6-9s6 4 6 9v15" },
  { name: "Launchixis", url: "https://launchixis.vercel.app", description: "Launch operations for new Ixis companies.", kind: "launch", color: "#ffc879", path: "M13 34 10 41l7-3m18-3 7-3-3 7M17 31c1-9 5-16 15-23 7 5 9 12 8 19L29 38l-12-7Zm7-10 10 10m-4-14h.1" },
  { name: "Recovra", url: "https://recovra.vercel.app", description: "Recover overcharges and control business spend with AI.", kind: "recovery", color: "#8fd3e0", path: "M9 11h30v27H9zM15 18h18M15 24h10m-10 7h7m7-2 4 4 7-8" },
  { name: "Geoxis", url: "https://spatial-dashboard-xi.vercel.app", description: "Watch the world move in live 3D.", kind: "map", color: "#75d9bd", path: "M24 6a18 18 0 1 0 0 36 18 18 0 0 0 0-36Zm-18 18h36M24 6c-6 6-8 12-8 18s2 12 8 18m0-36c6 6 8 12 8 18s-2 12-8 18m-4-18 4-4 4 4-4 6z" },
  { name: "Ominix", url: "https://nexxis-tau.vercel.app", description: "Marketplace with Ixis-only checkout.", kind: "network", color: "#77b7f7", path: "M9 24h10m10 0h10M24 9v10m0 10v10M24 19a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM8 20a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm32 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM20 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 32a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { name: "Wattixis", url: "https://wattixis.vercel.app", description: "Marketplace for spare energy, excess energy.", kind: "energy", color: "#f4c65b", path: "M27 5 12 27h12l-3 16 17-24H26z" },
];

export function CompaniesDirectory({ host }: { host: string }) {
  return (
    <section className="ix-family" data-host={host} aria-labelledby="ix-family-title">
      <div className="ix-family-inner">
        <div className="ix-family-intro">
          <p className="ix-family-eyebrow">THE APIXIS FAMILY</p>
          <h1 id="ix-family-title">Apixis Companies</h1>
          <p>The Ixis ecosystem • 15 companies, one platform • Explore and visit each company</p>
        </div>
        <div className="ix-family-grid">
          {companies.map((company) => (
            <article className="ix-family-card" key={company.name} style={{ "--ix-card-accent": company.color } as CSSProperties}>
              <div className="ix-family-art" role="img" aria-label={company.name + " illustrated " + company.kind}>
                <span className="ix-family-orbit" aria-hidden="true" />
                <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d={company.path} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="ix-family-spark ix-family-spark-one" aria-hidden="true" />
                <span className="ix-family-spark ix-family-spark-two" aria-hidden="true" />
              </div>
              <div className="ix-family-card-copy">
                <h2>{company.name}</h2>
                <p>{company.description}</p>
                <a className="ix-family-visit" href={company.url} target="_blank" rel="noopener noreferrer" aria-label={"Visit " + company.name + " site"}>Visit site <span aria-hidden="true">→</span></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
