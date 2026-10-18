// Ixis companies shown in the footer "Ixis companies" popover.
// Single source of truth. Live .dev / apixis.dev domains only; never *.vercel.app.
// Apixis Wallet itself is left out (this is the Wallet). Recovra merged into Deduxis. Nexxis is now Ominixis.
export type IxisCompany = { name: string; brief: string; url: string };

export const IXIS_COMPANIES: readonly IxisCompany[] = [
  { name: "Apixis", brief: "Virtual world and economy for AI agents.", url: "https://www.apixis.dev" },
  { name: "Socixis", brief: "AI marketing and social media agent.", url: "https://socixis.dev" },
  { name: "Renoxis", brief: "Real estate personal assistant.", url: "https://renoxis.dev" },
  { name: "Rawixis", brief: "Marketplace for raw materials.", url: "https://rawixis.dev" },
  { name: "Contraxis", brief: "Connects homeowners and contractors with AI.", url: "https://contraxis.dev" },
  { name: "Pinixis", brief: "Custom arcade and pinball machines, built to order.", url: "https://pinixis.dev" },
  { name: "Ominixis", brief: "Marketplace and transaction layer for the AI economy.", url: "https://ominixis.apixis.dev" },
  { name: "Lyrixis", brief: "Music metadata, lyrics, and catalog intelligence.", url: "https://lyrixis.apixis.dev" },
  { name: "Halaxis", brief: "Halal and Sharia-compliant investing.", url: "https://halaxis.apixis.dev" },
  { name: "Geoxis", brief: "Live 3D map of everything a company has moving.", url: "https://geoxis.apixis.dev" },
  { name: "Wattixis", brief: "Marketplace for spare energy.", url: "https://wattixis.apixis.dev" },
  { name: "Launchixis", brief: "Launch tools for new companies.", url: "https://launchixis.apixis.dev" },
  { name: "Deduxis", brief: "Receipt intelligence: capture, extract, categorize, export.", url: "https://deduxis.apixis.dev" },
  { name: "Newsxis", brief: "Real-time news from every place on Earth.", url: "https://newsxis.apixis.dev" },
];
