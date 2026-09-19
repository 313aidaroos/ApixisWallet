export type Bulletin = {
  id: string;
  source: "Apixis Family" | "Wallet" | "Renoxis" | "Socixis" | "System";
  tag: "ANNOUNCE" | "SHIP" | "PRICE" | "ALERT";
  title: string;
  body: string;
  at: string;
};

export const bulletins: Bulletin[] = [
  {
    id: "1",
    source: "Apixis Family",
    tag: "ANNOUNCE",
    title: "One checkout across the empire",
    body: "Apixis Wallet is the only place dollars enter. Renoxis, Socixis, Recovra and Deduxis redeem XP.",
    at: "2026-09-19 15:00 CDT",
  },
  {
    id: "2",
    source: "Wallet",
    tag: "PRICE",
    title: "Peg holds at 100 XP = $1",
    body: "No bonus coins. Seats include a cap. Extra AI, images, video and ads burn meter XP.",
    at: "2026-09-19 14:40 CDT",
  },
  {
    id: "3",
    source: "Socixis",
    tag: "SHIP",
    title: "Autopilot now bills Wallet",
    body: "Growth/Business Stripe checkouts on sister apps are retired. Redeem 45,000 XP / month.",
    at: "2026-09-19 12:10 CDT",
  },
  {
    id: "4",
    source: "Renoxis",
    tag: "SHIP",
    title: "Agent Office cap = 40 AI jobs",
    body: "Job 41+ burns meter XP so image and model cost stay covered.",
    at: "2026-09-18 18:22 CDT",
  },
  {
    id: "5",
    source: "System",
    tag: "ALERT",
    title: "Stripe and Supabase keys still dark",
    body: "Demo tape and local balance until Vercel env is attached.",
    at: "2026-09-19 15:30 CDT",
  },
];

export const ticker = bulletins.map((b) => `${b.tag} · ${b.source} · ${b.title}`).join("    ///    ");
