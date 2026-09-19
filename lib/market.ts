export const PEG_USD = 0.01;

export type SeriesPoint = { t: string; circulating: number; buyXp: number; redeemXp: number };

/** Demo 30-day economy tape. Price is the peg. The moving series is supply and volume. */
export const xpTape: SeriesPoint[] = [
  { t: "Aug 21", circulating: 182000, buyXp: 15000, redeemXp: 8000 },
  { t: "Aug 22", circulating: 189000, buyXp: 15000, redeemXp: 8000 },
  { t: "Aug 23", circulating: 201000, buyXp: 36000, redeemXp: 24000 },
  { t: "Aug 24", circulating: 212000, buyXp: 15000, redeemXp: 4000 },
  { t: "Aug 25", circulating: 228000, buyXp: 52500, redeemXp: 36500 },
  { t: "Aug 26", circulating: 241000, buyXp: 15000, redeemXp: 2000 },
  { t: "Aug 27", circulating: 255000, buyXp: 36000, redeemXp: 22000 },
  { t: "Aug 28", circulating: 249000, buyXp: 0, redeemXp: 6000 },
  { t: "Aug 29", circulating: 268000, buyXp: 36000, redeemXp: 17000 },
  { t: "Aug 30", circulating: 291000, buyXp: 52500, redeemXp: 29500 },
  { t: "Aug 31", circulating: 304000, buyXp: 15000, redeemXp: 2000 },
  { t: "Sep 1", circulating: 318000, buyXp: 36000, redeemXp: 22000 },
  { t: "Sep 2", circulating: 333000, buyXp: 15000, redeemXp: 0 },
  { t: "Sep 3", circulating: 356000, buyXp: 52500, redeemXp: 29500 },
  { t: "Sep 4", circulating: 371000, buyXp: 15000, redeemXp: 0 },
  { t: "Sep 5", circulating: 388000, buyXp: 36000, redeemXp: 19000 },
  { t: "Sep 6", circulating: 401000, buyXp: 15000, redeemXp: 2000 },
  { t: "Sep 7", circulating: 429000, buyXp: 52500, redeemXp: 24500 },
  { t: "Sep 8", circulating: 444000, buyXp: 15000, redeemXp: 0 },
  { t: "Sep 9", circulating: 470000, buyXp: 36000, redeemXp: 10000 },
  { t: "Sep 10", circulating: 492000, buyXp: 52500, redeemXp: 30500 },
  { t: "Sep 11", circulating: 507000, buyXp: 15000, redeemXp: 0 },
  { t: "Sep 12", circulating: 538000, buyXp: 107500, redeemXp: 76500 },
  { t: "Sep 13", circulating: 551000, buyXp: 15000, redeemXp: 2000 },
  { t: "Sep 14", circulating: 572000, buyXp: 36000, redeemXp: 15000 },
  { t: "Sep 15", circulating: 594000, buyXp: 52500, redeemXp: 30500 },
  { t: "Sep 16", circulating: 609000, buyXp: 15000, redeemXp: 0 },
  { t: "Sep 17", circulating: 640000, buyXp: 36000, redeemXp: 5000 },
  { t: "Sep 18", circulating: 676000, buyXp: 52500, redeemXp: 16500 },
  { t: "Sep 19", circulating: 698500, buyXp: 36000, redeemXp: 13500 },
];

export const productTape = [
  { key: "renoxis.agent.monthly", symbol: "RNX", name: "Renoxis", color: "#c8ff63", volume30: 180000, redeemXp: [8, 8, 15, 15, 15, 0, 15, 15, 15, 20, 15, 15, 0, 15, 15, 15, 0, 15, 15, 15, 20, 15, 30, 15, 15, 20, 15, 15, 15, 15] },
  { key: "socixis.autopilot.monthly", symbol: "SOC", name: "Socixis", color: "#ff6bce", volume30: 140000, redeemXp: [0, 0, 20, 0, 20, 0, 20, 0, 20, 20, 0, 20, 0, 20, 0, 20, 0, 20, 0, 20, 20, 0, 40, 0, 20, 20, 0, 20, 0, 20] },
  { key: "recovra.intel.monthly", symbol: "RCV", name: "Recovra", color: "#58c8ff", volume30: 72000, redeemXp: [0, 12, 0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 12, 0, 24, 0, 0, 12, 0, 0, 12, 0] },
  { key: "deduxis.receipts.monthly", symbol: "DDX", name: "Deduxis", color: "#ffbd59", volume30: 48000, redeemXp: [8, 0, 8, 0, 8, 0, 8, 0, 8, 0, 8, 0, 0, 8, 0, 8, 0, 8, 0, 8, 0, 0, 16, 0, 8, 0, 8, 0, 8, 8] },
];

export function last24h(tape: SeriesPoint[]) {
  const d = tape[tape.length - 1];
  return {
    circulating: d.circulating,
    capUsd: d.circulating * PEG_USD,
    volumeXp: d.buyXp + d.redeemXp,
    volumeUsd: (d.buyXp + d.redeemXp) * PEG_USD,
    buyXp: d.buyXp,
    redeemXp: d.redeemXp,
  };
}
