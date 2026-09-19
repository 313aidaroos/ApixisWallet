/** 100 XP = $1 at purchase. Profit is taken on redeem, not on the pack. */
export const pointPacks = [
  { id: "agent", name: "Starter", price: 100, xp: 10000, bonus: 0 },
  { id: "office", name: "Studio", price: 500, xp: 50000, bonus: 0 },
  { id: "business", name: "Empire", price: 1500, xp: 150000, bonus: 0 },
] as const;

export const redeemCatalog = [
  { key: "renoxis.agent.monthly", app: "Renoxis", name: "Agent Office", xp: 30000, color: "#c8ff63", includes: "Seat + 40 AI jobs" },
  { key: "socixis.autopilot.monthly", app: "Socixis", name: "Social Autopilot", xp: 45000, color: "#ff6bce", includes: "20 posts + 20 images" },
  { key: "socixis.avatar.base", app: "Socixis", name: "Avatar base (real me)", xp: 1000, color: "#ff8a3d", includes: "Photo → likeness + 1 restyle" },
  { key: "socixis.avatar.skin.cartoon", app: "Socixis", name: "Skin: Cartoon", xp: 1000, color: "#ff8a3d", includes: "Unlock cartoon look" },
  { key: "socixis.avatar.skin.anime", app: "Socixis", name: "Skin: Anime", xp: 1000, color: "#ff8a3d", includes: "Unlock anime look" },
  { key: "socixis.avatar.skin.hero", app: "Socixis", name: "Skin: Comic hero", xp: 1000, color: "#ff8a3d", includes: "Unlock hero look" },
  { key: "socixis.avatar.skin.retro", app: "Socixis", name: "Skin: Retro player", xp: 1000, color: "#ff8a3d", includes: "Unlock 16-bit look" },
  { key: "socixis.avatar.skin.character", app: "Socixis", name: "Skin: 3D character", xp: 1000, color: "#ff8a3d", includes: "Unlock 3D look" },
  { key: "socixis.avatar.skin.digital", app: "Socixis", name: "Skin: Digital", xp: 1000, color: "#ff8a3d", includes: "Unlock CGI look" },
  { key: "socixis.avatar.pack.all", app: "Socixis", name: "All avatar skins", xp: 5000, color: "#ff8a3d", includes: "Every look, one redeem" },
  { key: "recovra.intel.monthly", app: "Recovra", name: "Recovery Intelligence", xp: 22000, color: "#58c8ff", includes: "Seat + 120 extracts" },
  { key: "deduxis.receipts.monthly", app: "Deduxis", name: "Receipt Intelligence", xp: 15000, color: "#ffbd59", includes: "Seat + 200 receipts" },
] as const;

export const meterCatalog = [
  { key: "ai.text", name: "AI text job", xp: 40, costXp: 10 },
  { key: "ai.image", name: "Image", xp: 150, costXp: 40 },
  { key: "ai.video", name: "Video clip", xp: 800, costXp: 250 },
  { key: "ai.ads", name: "Ad set", xp: 400, costXp: 120 },
] as const;
