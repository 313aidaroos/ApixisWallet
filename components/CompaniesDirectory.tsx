"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const companies = [
  {
    name: "Apixis",
    url: "https://www.apixis.dev",
    description: "Virtual world and economy for AI agents.",
    kind: "globe",
    color: "#d7ad64",
    path: "M24 8a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm-16 16h32M24 8c-5 5-7 10-7 16s2 11 7 16m0-32c5 5 7 10 7 16s-2 11-7 16",
  },
  {
    name: "Apixis Wallet",
    url: "https://apixis-wallet.vercel.app",
    description: "Your Ixis wallet. Buy, hold, spend across every company.",
    kind: "wallet",
    color: "#e0b35c",
    path: "M6 15h34v25H6zM6 15V9h28v6m0 10h10v9H34a4 4 0 0 1 0-9Zm4 4h1",
  },
  {
    name: "Socixis",
    url: "https://socixis.dev",
    description:
      "Your own personal marketer, automated posts and advertisements.",
    kind: "social",
    color: "#bd83e6",
    path: "M8 12h32v23H22l-8 7v-7H8zM16 21h16M16 27h10m12-12 3-6m-9 4 2-8",
  },
  {
    name: "Lyrixis",
    url: "https://lyrixis.vercel.app",
    description: "Voice and media/music metadata.",
    kind: "music",
    color: "#a998ff",
    path: "M18 33V13l20-4v20M18 33c-3-2-8-1-8 3s5 5 8 2m20-9c-3-2-8-1-8 3s5 5 8 2M18 20l20-4",
  },
  {
    name: "Pinixis",
    url: "https://pinixis.vercel.app",
    description: "Collectible marketplace and arcade.",
    kind: "arcade",
    color: "#ffbd55",
    path: "M10 17h28l5 21H5zM18 24v10m-5-5h10m11-4h.1m-3 7h.1M16 17l3-8h10l3 8",
  },
  {
    name: "Renoxis",
    url: "https://renoxis.dev",
    description:
      "Your real estate AI. Deals, clients, commissions on autopilot.",
    kind: "home",
    color: "#63cfab",
    path: "M5 24 24 8l19 16M10 22v20h28V22M19 42V29h10v13m-15-21 10-8 10 8",
  },
  {
    name: "Contraxis",
    url: "https://contraxis-dev.vercel.app",
    description: "The everything-marketplace. Find pros for any job.",
    kind: "tools",
    color: "#eea46c",
    path: "M11 36 34 13m-21-2 6 6m17 19-6-6M9 31l8 8m-3-29 8 8m18 13-8 8M29 11l8 8",
  },
  {
    name: "Deduxis",
    url: "https://deduxis.vercel.app",
    description:
      "Snap a receipt. AI extracts, categorizes, exports your taxes.",
    kind: "receipt",
    color: "#8bdbca",
    path: "M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3zM18 17h12M18 24h12M18 31h7",
  },
  {
    name: "Rawixis",
    url: "https://rawixis.vercel.app",
    description: "B2B market for critical raw materials.",
    kind: "crystal",
    color: "#d6b476",
    path: "m24 6 16 16-16 20L8 22 24 6Zm-16 16h32M24 6l-6 16 6 20 6-20-6-16Z",
  },
  {
    name: "Halaxis",
    url: "https://halaxis.vercel.app",
    description: "Sharia-compliant hedge fund.",
    kind: "arch",
    color: "#c78d9e",
    path: "M10 41V24c0-12 14-18 14-18s14 6 14 18v17M10 41h28M18 41V26c0-5 6-9 6-9s6 4 6 9v15",
  },
  {
    name: "Launchixis",
    url: "https://launchixis.vercel.app",
    description: "Launch operations for new Ixis companies.",
    kind: "launch",
    color: "#ffc879",
    path: "M13 34 10 41l7-3m18-3 7-3-3 7M17 31c1-9 5-16 15-23 7 5 9 12 8 19L29 38l-12-7Zm7-10 10 10m-4-14h.1",
  },
  {
    name: "Recovra",
    url: "https://recovra-three.vercel.app",
    description: "Recover overcharges and control business spend with AI.",
    kind: "recovery",
    color: "#8fd3e0",
    path: "M9 11h30v27H9zM15 18h18M15 24h10m-10 7h7m7-2 4 4 7-8",
  },
  {
    name: "Geoxis",
    url: "https://spatial-dashboard-xi.vercel.app",
    description: "Watch the world move in live 3D.",
    kind: "map",
    color: "#75d9bd",
    path: "M24 6a18 18 0 1 0 0 36 18 18 0 0 0 0-36Zm-18 18h36M24 6c-6 6-8 12-8 18s2 12 8 18m0-36c6 6 8 12 8 18s-2 12-8 18m-4-18 4-4 4 4-4 6z",
  },
  {
    name: "Ominix",
    url: "https://nexxis-tau.vercel.app",
    description: "Marketplace with Ixis-only checkout.",
    kind: "network",
    color: "#77b7f7",
    path: "M9 24h10m10 0h10M24 9v10m0 10v10M24 19a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM8 20a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm32 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM20 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 32a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  },
  {
    name: "Wattixis",
    url: "https://wattixis.vercel.app",
    description: "Marketplace for spare energy, excess energy.",
    kind: "energy",
    color: "#f4c65b",
    path: "M27 5 12 27h12l-3 16 17-24H26z",
  },
];

const videos: Record<string, string> = {
  "scenes-1":
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024538_04ea151c-26e7-4fa2-a269-0f9886617c9b.mp4",
  "scenes-2":
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024538_b56b0007-a204-475d-899e-14ee9c585e2b.mp4",
  "scenes-3":
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024538_2116d724-44bb-4d7e-89d9-8b30cc59d800.mp4",
  "scenes-4":
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024539_021c17b7-6471-4541-a946-a3e6aeb4d0d2.mp4",
  "scenes-5":
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024537_be17da6b-bdf8-466b-b952-a37f2a62e92d.mp4",
  recovra:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3I9IxN8XAUFfWP3X6OzJQUZLlWx/hf_20261005_024538_80d442d8-499d-4ccf-8e5b-f714ca399d4b.mp4",
};

function CompanyCard({
  company,
  index,
  motion,
}: {
  company: (typeof companies)[number];
  index: number;
  motion: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    badge = useRef<HTMLCanvasElement>(null);
  const scene =
    index === 11 ? "recovra" : `scenes-${Math.floor(index / 3) + 1}`;
  const panel = index === 11 ? 0 : index % 3;
  const bounds =
    index === 11
      ? [0, 1]
      : scene === "scenes-2"
        ? [0, 0.348, 0.652, 1]
        : [0, 0.3, 0.7, 1];
  const start = bounds[panel] + 0.008,
    end = bounds[panel + 1] - 0.008;
  useEffect(() => {
    const ctx = badge.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 100, 100);
    ctx.save();
    ctx.translate(18, 18);
    ctx.scale(64 / 48, 64 / 48);
    ctx.strokeStyle = company.color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(company.path));
    ctx.restore();
  }, [company]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let visible = false;
    const update = () => {
      if (visible && motion && !document.hidden) {
        if (!el.getAttribute("src")) el.src = videos[scene];
        el.play().catch(() => {});
      } else el.pause();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        update();
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      el.pause();
    };
  }, [motion, scene]);
  const style = {
    "--company": company.color,
    "--scene": `url('https://www.apixis.dev/assets/companies/${scene}.jpg')`,
    "--scene-size": index === 11 ? "cover" : "300% auto",
    "--scene-x": `${index === 11 ? 50 : panel * 50}%`,
    "--video-width": `${100 / (end - start)}%`,
    "--video-left": `${(-100 * start) / (end - start)}%`,
  } as CSSProperties;
  return (
    <article className="ix-app ix-cinematic-card" style={style}>
      <div className="ix-company-film">
        <span
          className="ix-reference-art"
          role="img"
          aria-label={`${company.name} illustration`}
        />
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          onLoadedData={(e) => e.currentTarget.classList.add("ix-film-ready")}
          onError={(e) => e.currentTarget.classList.remove("ix-film-ready")}
        />
        <span className="ix-film-shade" />
        <canvas
          ref={badge}
          width={100}
          height={100}
          className="ix-company-badge"
          aria-hidden="true"
        />
      </div>
      <div className="ix-card-copy">
        <h3>{company.name}</h3>
        <p>{company.description}</p>
        <a
          className="ix-company-visit"
          href={company.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${company.name} site`}
        >
          Visit site <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function CompaniesDirectory({
  motion = false,
  featured = false,
}: {
  motion?: boolean;
  featured?: boolean;
}) {
  const selected = featured ? [5, 2, 3] : companies.map((_, index) => index);
  return (
    <div className={featured ? "ix-app-grid" : "ix-company-grid"}>
      {selected.map((index) => (
        <CompanyCard
          key={companies[index].name}
          company={companies[index]}
          index={index}
          motion={motion}
        />
      ))}
    </div>
  );
}
