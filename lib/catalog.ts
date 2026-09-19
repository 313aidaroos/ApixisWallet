/** 100 XP = $1. No bonus XP. Bonus was free liability. */
export const pointPacks = [
  { id: "agent", name: "Starter", price: 100, xp: 10000, bonus: 0 },
  { id: "office", name: "Studio", price: 500, xp: 50000, bonus: 0 },
  { id: "business", name: "Empire", price: 1500, xp: 150000, bonus: 0 },
] as const;

export const redeemCatalog = [
  {
    key: "renoxis.agent.monthly",
    app: "Renoxis",
    name: "Agent Office",
    xp: 25000,
    color: "#c8ff63",
    includes: "Seat + 80 AI jobs",
  },
  {
    key: "socixis.autopilot.monthly",
    app: "Socixis",
    name: "Social Autopilot",
    xp: 35000,
    color: "#ff6bce",
    includes: "30 posts + 30 images",
  },
  {
    key: "recovra.intel.monthly",
    app: "Recovra",
    name: "Recovery Intelligence",
    xp: 18000,
    color: "#58c8ff",
    includes: "Seat + 200 extracts",
  },
  {
    key: "deduxis.receipts.monthly",
    app: "Deduxis",
    name: "Receipt Intelligence",
    xp: 12000,
    color: "#ffbd59",
    includes: "Seat + 300 receipts",
  },
] as const;

export const meterCatalog = [
  { key: "ai.text", name: "AI text job", xp: 25, note: "chat / copy / brief" },
  { key: "ai.image", name: "Image", xp: 80, note: "covers model + retries" },
  { key: "ai.video", name: "Video clip", xp: 400, note: "short render" },
  { key: "ai.ads", name: "Ad set", xp: 200, note: "copy + 3 images" },
] as const;
