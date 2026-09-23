/** 100 Ixis = $1. Same SKU prices on every apple. */
export const pointPacks = [
  { id: "spark", name: "Spark", price: 10, xp: 1000, bonus: 0 },
  { id: "agent", name: "Starter", price: 100, xp: 10000, bonus: 0 },
  { id: "office", name: "Studio", price: 500, xp: 50000, bonus: 0 },
  { id: "business", name: "Empire", price: 1500, xp: 150000, bonus: 0 },
] as const;

/** One ladder: seats are monthly, files/templates/skins are $10. */
export const UNIT_XP = 1000;

export const redeemCatalog = [
  { key: "renoxis.activate", app: "Renoxis", name: "Renoxis Activate", xp: 5000, color: "#c8ff63", includes: "One-time activation · $50" },
  { key: "renoxis.agent.monthly", app: "Renoxis", name: "Renoxis Monthly", xp: 5000, color: "#c8ff63", includes: "Month seat · $50/mo" },
  { key: "socixis.autopilot.monthly", app: "Socixis", name: "Social Autopilot", xp: 45000, color: "#ff6bce", includes: "20 posts + 20 images" },
  { key: "recovra.intel.monthly", app: "Recovra", name: "Recovery Intelligence · Starter", xp: 22000, color: "#58c8ff", includes: "Seat + 120 extracts · $220/mo" },
  { key: "recovra.intel.growth", app: "Recovra", name: "Recovery Intelligence · Growth", xp: 44000, color: "#58c8ff", includes: "Multi-module · workflows · reporting · $440/mo" },
  { key: "deduxis.receipts.monthly", app: "Deduxis", name: "Receipt Intelligence", xp: 15000, color: "#ffbd59", includes: "Seat + 200 receipts" },
  { key: "contentbot.creator.monthly", app: "PersonalContentBot", name: "Creator Seat", xp: 20000, color: "#a855f7", includes: "Unlimited 60s videos · 30 days" },
  { key: "rawixis.buyer.seat.base", app: "Rawixis", name: "Buyer seat (Base)", xp: 15000, color: "#d4af37", includes: "10 RFQs · basic verification · 30 days" },
  { key: "rawixis.buyer.seat.pro", app: "Rawixis", name: "Buyer seat (Pro)", xp: 35000, color: "#d4af37", includes: "Unlimited RFQs · tier 2-3 suppliers · 30 days" },
  { key: "rawixis.supplier.seat.base", app: "Rawixis", name: "Supplier seat (Base)", xp: 20000, color: "#d4af37", includes: "20 quote responses · tier 1 · 30 days" },
  { key: "rawixis.supplier.seat.verified", app: "Rawixis", name: "Supplier seat (Verified)", xp: 45000, color: "#d4af37", includes: "Unlimited responses · tier 2-3 · 30 days" },

  { key: "apixis.activate", app: "Apixis.dev", name: "Citizen activation", xp: 2000, color: "#46e6ff", includes: "One-time door. Was $20 card." },
  { key: "apixis.citizen.monthly", app: "Apixis.dev", name: "Citizen seat", xp: 2000, color: "#46e6ff", includes: "Month + 2,000 in-world Ixis" },
  { key: "apixis.founder.monthly", app: "Apixis.dev", name: "Founder seat", xp: 10000, color: "#b14bff", includes: "Month + 12,000 in-world Ixis" },
  { key: "apixis.ixis.pack", app: "Apixis.dev", name: "Ixis top-up", xp: UNIT_XP, color: "#46e6ff", includes: "1,000 Ixis in-world. Bought with XP." },
  { key: "contraxis.seat.starter", app: "Contraxis", name: "Pro Starter", xp: 9900, color: "#22d3ee", includes: "Was $99/mo card. Now XP." },
  { key: "contraxis.seat.pro", app: "Contraxis", name: "Pro Professional", xp: 39900, color: "#22d3ee", includes: "Was $399/mo card. Now XP." },

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
  { key: "contentbot.clip", app: "PersonalContentBot", name: "60s Video Clip", xp: 800, color: "#a855f7", includes: "Script + storyboard + render (9:16 or 16:9)" },
  { key: "contentbot.text", app: "PersonalContentBot", name: "AI Text Job", xp: 40, color: "#a855f7", includes: "Script generation only" },
  { key: "contentbot.image", app: "PersonalContentBot", name: "AI Image", xp: 150, color: "#a855f7", includes: "Generated image for visuals" },
  { key: "contentbot.adset", app: "PersonalContentBot", name: "Ad Set", xp: 400, color: "#a855f7", includes: "Multiple variations for A/B testing" },
  { key: "rawixis.featured.listing", app: "Rawixis", name: "Featured listing", xp: 3000, color: "#d4af37", includes: "30 days top placement" },
  { key: "rawixis.rfq.pack.5", app: "Rawixis", name: "RFQ pack (5)", xp: 2000, color: "#d4af37", includes: "5 additional RFQs" },
  { key: "rawixis.rfq.pack.20", app: "Rawixis", name: "RFQ pack (20)", xp: 7000, color: "#d4af37", includes: "20 additional RFQs" },
  { key: "rawixis.logistics.quote", app: "Rawixis", name: "Logistics quote", xp: 1500, color: "#d4af37", includes: "Freight + duty + landed cost calc" },
  // Lyrixis
  { key: "lyrixis.track.unlock", app: "Lyrixis", name: "Unlock 1 track export", xp: 300, color: "#22d3ee", includes: "Metered per-track unlock · $3 (per-use, floor-exempt)" },
  // Qahwahworld — key must match what the site sends (roaster_seat_monthly)
  { key: "roaster_seat_monthly", app: "Qahwahworld", name: "Roaster seat", xp: 10000, color: "#a0522d", includes: "Monthly roaster seat · $100/mo" },
  { key: "seller_seat_monthly", app: "Qahwahworld", name: "Seller seat", xp: 20000, color: "#a0522d", includes: "Monthly seller seat · $200/mo" },
  { key: "featured_listing", app: "Qahwahworld", name: "Featured lot listing", xp: 1000, color: "#a0522d", includes: "One-off featured placement · $10" },
  // Nursery Toons — keys match api/redeem.js
  { key: "nurserytoons-family-monthly", app: "Nursery Toons", name: "Family Plan", xp: 5000, color: "#ffb703", includes: "Monthly family plan · $50/mo" },
  { key: "nurserytoons-printables", app: "Nursery Toons", name: "Printables Pack", xp: 1000, color: "#ffb703", includes: "One-off printables · $10 (family floor)" },
  // Geoxis — keys match pricing.html data-product
  { key: "geoxis.tracking.small", app: "Geoxis", name: "Tracking · Small fleet", xp: 10000, color: "#10b981", includes: "Up to 10 assets · 30 days · $100/mo" },
  { key: "geoxis.tracking.medium", app: "Geoxis", name: "Tracking · Medium fleet", xp: 25000, color: "#10b981", includes: "Up to 50 assets · 30 days · $250/mo" },
  { key: "geoxis.tracking.large", app: "Geoxis", name: "Tracking · Large fleet", xp: 45000, color: "#10b981", includes: "Up to 200 assets · 30 days · $450/mo" },
  { key: "geoxis.export.report", app: "Geoxis", name: "Export report", xp: 1000, color: "#10b981", includes: "One-off report export · $10" },
  // Launchixis — pricing page tiers
  { key: "launchixis.template.checklist", app: "Launchixis", name: "Launch Checklist Template", xp: 1000, color: "#7c3aed", includes: "One-off template · $10" },
  { key: "launchixis.brandkit", app: "Launchixis", name: "Brand Kit One-off", xp: 1000, color: "#7c3aed", includes: "One-off brand kit · $10" },
  { key: "launchixis.seat.monthly", app: "Launchixis", name: "Launch Ops Seat", xp: 10000, color: "#7c3aed", includes: "Monthly operator seat · $100/mo" },
  { key: "launchixis.suite.monthly", app: "Launchixis", name: "Enterprise Launch Suite", xp: 30000, color: "#7c3aed", includes: "Monthly enterprise suite · $300/mo" },
] as const;

/**
 * Shop goods sold in the Wallet Shop tab. Ixis only (100 Ixis = $1).
 * Floor is UNIT_XP (1,000 Ixis / $10). Spends are wallet → product, same
 * quote path as redeemCatalog — not Stripe cash packs.
 * Sister apps: keys below are quotable; see docs/INTEGRATION.md.
 * Merch art is placeholder until Awad fills the designs.
 */
export const shopCategories = [
  { id: "templates", label: "Templates" },
  // Cixy and merch categories hidden until items exist
  // { id: "cixy", label: "Cixy" },
  // { id: "merch", label: "Merch" },
] as const;

export type ShopCategory = (typeof shopCategories)[number]["id"];

export const shopCatalog = [
  { key: "shop.template.file.unit", category: "templates", app: "Family", name: "File / template unit", xp: UNIT_XP, color: "#9dff4a", blurb: "Any file, template, or skin. Same $10 unit on every site." },
  { key: "shop.template.site.saas", category: "templates", app: "Socixis", name: "Site pack: SaaS", xp: UNIT_XP, color: "#2563eb", blurb: "Animated interactive site pack." },
  { key: "shop.template.site.shop", category: "templates", app: "Socixis", name: "Site pack: Shop lite", xp: UNIT_XP, color: "#2563eb", blurb: "Catalog pack for a small storefront." },
  { key: "shop.template.listing", category: "templates", app: "Renoxis", name: "Listing file", xp: UNIT_XP, color: "#c8ff63", blurb: "One listing template." },
  { key: "shop.template.offer", category: "templates", app: "Renoxis", name: "Offer file", xp: UNIT_XP, color: "#c8ff63", blurb: "One offer template." },

  // Cixy and merch placeholders removed until designs exist (per billing hardening Item 5)
  // { key: "shop.cixy.voice", category: "cixy", app: "Cixy", name: "Voice pack", xp: UNIT_XP, color: "#ff6bce", blurb: "Voice customization. Sound lands when Awad fills it." },
  // { key: "shop.cixy.skin", category: "cixy", app: "Cixy", name: "Skin pack", xp: 2500, color: "#ff6bce", blurb: "Look customization. Art lands when Awad fills it." },
  // { key: "shop.cixy.persona", category: "cixy", app: "Cixy", name: "Persona pack", xp: 5000, color: "#b14bff", blurb: "Tone, habits, and replies. Persona lands when Awad fills it." },
  // { key: "shop.merch.tee", category: "merch", app: "Apixis", name: "Tee", xp: 2500, color: "#ffbd59", blurb: "Design coming. We'll fulfill when designs land." },
  // { key: "shop.merch.hoodie", category: "merch", app: "Apixis", name: "Hoodie", xp: 5000, color: "#ffbd59", blurb: "Design coming. We'll fulfill when designs land." },
  // { key: "shop.merch.sticker", category: "merch", app: "Apixis", name: "Sticker pack", xp: UNIT_XP, color: "#ffbd59", blurb: "Design coming. We'll fulfill when designs land." },
  // { key: "shop.merch.mug", category: "merch", app: "Apixis", name: "Mug", xp: 1500, color: "#ffbd59", blurb: "Design coming. We'll fulfill when designs land." },
] as const;

/**
 * Aliases resolve to one catalog row. Renoxis monthly is only
 * `renoxis.agent.monthly` — do not add a second 5,000 Ixis month key.
 */
const catalogAliases: Record<string, string> = {
  "renoxis-activate": "renoxis.activate",
  "renoxis-monthly": "renoxis.agent.monthly",
  "renoxis.monthly": "renoxis.agent.monthly",
};

/** Redeem seats and Shop goods. Cash packs stay in pointPacks. */
export function findCatalogProduct(productKey: string) {
  const requested = productKey.trim();
  const key = catalogAliases[requested] ?? requested;
  return (
    redeemCatalog.find((item) => item.key === key) ??
    shopCatalog.find((item) => item.key === key)
  );
}

export const meterCatalog = [
  { key: "ai.text", name: "AI text job", xp: 40, costXp: 10 },
  { key: "ai.image", name: "Image", xp: 150, costXp: 40 },
  { key: "ai.video", name: "Video clip", xp: 800, costXp: 250 },
  { key: "ai.ads", name: "Ad set", xp: 400, costXp: 120 },
] as const;
