/** 100 XP = $1. Same SKU prices on every apple. */
export const pointPacks = [
  { id: "agent", name: "Starter", price: 100, xp: 10000, bonus: 0 },
  { id: "office", name: "Studio", price: 500, xp: 50000, bonus: 0 },
  { id: "business", name: "Empire", price: 1500, xp: 150000, bonus: 0 },
] as const;

/** One ladder: seats are monthly, files/templates/skins are $10. */
export const UNIT_XP = 1000;

export const redeemCatalog = [
  { key: "renoxis.agent.monthly", app: "Renoxis", name: "Agent Office", xp: 30000, color: "#c8ff63", includes: "Seat + 40 AI jobs" },
  { key: "socixis.autopilot.monthly", app: "Socixis", name: "Social Autopilot", xp: 45000, color: "#ff6bce", includes: "20 posts + 20 images" },
  { key: "recovra.intel.monthly", app: "Recovra", name: "Recovery Intelligence", xp: 22000, color: "#58c8ff", includes: "Seat + 120 extracts" },
  { key: "deduxis.receipts.monthly", app: "Deduxis", name: "Receipt Intelligence", xp: 15000, color: "#ffbd59", includes: "Seat + 200 receipts" },

  { key: "apixis.file.unit", app: "Family", name: "Any file / template / skin", xp: UNIT_XP, color: "#9dff4a", includes: "$10 unit · same on every site" },
  { key: "socixis.avatar.base", app: "Socixis", name: "Avatar base", xp: UNIT_XP, color: "#ff8a3d", includes: "Photo → real me + 1 restyle" },
  { key: "socixis.avatar.skin.cartoon", app: "Socixis", name: "Skin: Cartoon", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.avatar.skin.anime", app: "Socixis", name: "Skin: Anime", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.avatar.skin.hero", app: "Socixis", name: "Skin: Comic hero", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.avatar.skin.retro", app: "Socixis", name: "Skin: Retro player", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.avatar.skin.character", app: "Socixis", name: "Skin: 3D character", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.avatar.skin.digital", app: "Socixis", name: "Skin: Digital", xp: UNIT_XP, color: "#ff8a3d", includes: "Look unlock" },
  { key: "socixis.site.saas", app: "Socixis", name: "Site pack: SaaS", xp: UNIT_XP, color: "#2563eb", includes: "Animated interactive pack" },
  { key: "socixis.site.restaurant", app: "Socixis", name: "Site pack: Restaurant", xp: UNIT_XP, color: "#2563eb", includes: "Menu-first pack" },
  { key: "socixis.site.portfolio", app: "Socixis", name: "Site pack: Portfolio", xp: UNIT_XP, color: "#2563eb", includes: "Work pack" },
  { key: "socixis.site.local", app: "Socixis", name: "Site pack: Local service", xp: UNIT_XP, color: "#2563eb", includes: "Geo pack" },
  { key: "socixis.site.shop", app: "Socixis", name: "Site pack: Shop lite", xp: UNIT_XP, color: "#2563eb", includes: "Catalog pack" },
  { key: "socixis.site.agency", app: "Socixis", name: "Site pack: Agency", xp: UNIT_XP, color: "#2563eb", includes: "Case-study pack" },
  { key: "renoxis.file.listing", app: "Renoxis", name: "Listing file", xp: UNIT_XP, color: "#c8ff63", includes: "One listing template" },
  { key: "renoxis.file.offer", app: "Renoxis", name: "Offer file", xp: UNIT_XP, color: "#c8ff63", includes: "One offer template" },
] as const;

export const meterCatalog = [
  { key: "ai.text", name: "AI text job", xp: 40, costXp: 10 },
  { key: "ai.image", name: "Image", xp: 150, costXp: 40 },
  { key: "ai.video", name: "Video clip", xp: 800, costXp: 250 },
  { key: "ai.ads", name: "Ad set", xp: 400, costXp: 120 },
] as const;
