// Other Ixis companies shown in the Wallet footer. One place to swap URLs
// when custom domains arrive. Apixis Wallet itself is left out (this is the Wallet site).
// 2026-09-29 Grok (Wallet Lead).
export type IxisCompany = { name: string; url: string };

export const OTHER_IXIS_COMPANIES: readonly IxisCompany[] = [
  { name: "Apixis", url: "https://www.apixis.dev" },
  { name: "Socixis", url: "https://socixis.dev" },
  { name: "Renoxis", url: "https://renoxis.dev" },
  { name: "Rawixis", url: "https://rawixis.vercel.app" },
  { name: "Contraxis", url: "https://contraxis-dev.vercel.app" },
  { name: "Lyrixis", url: "https://lyrixis.vercel.app" },
  { name: "Halaxis", url: "https://halaxis.vercel.app" },
  { name: "Recovra", url: "https://recovra-three.vercel.app" },
  { name: "Deduxis", url: "https://deduxis.vercel.app" },
  { name: "Geoxis", url: "https://spatial-dashboard-xi.vercel.app" },
  { name: "Wattixis", url: "https://wattixis.vercel.app" },
];
