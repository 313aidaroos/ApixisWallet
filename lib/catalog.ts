export const pointPacks = [
  { id: "agent", name: "Agent Pack", price: 150, xp: 15000, bonus: 0 },
  { id: "office", name: "Office Pack", price: 350, xp: 36000, bonus: 1000 },
  { id: "power", name: "Power Pack", price: 500, xp: 52500, bonus: 2500 },
  { id: "business", name: "Business Pack", price: 1000, xp: 107500, bonus: 7500 },
] as const;

export const products = [
  { app: "Renoxis", name: "Agent Office", xp: 15000, color: "#c8ff63" },
  { app: "Socixis", name: "Social Autopilot", xp: 20000, color: "#ff6bce" },
  { app: "Recovra", name: "Recovery Intelligence", xp: 12000, color: "#58c8ff" },
  { app: "Deduxis", name: "Receipt Intelligence", xp: 8000, color: "#ffbd59" },
] as const;
