/** Closed-loop credits until counsel clearance. Anything other than `live` stays `demo`. */
export type IxisAssetMode = "demo" | "live";

export function getIxisAssetMode(source?: string | null): IxisAssetMode {
  const raw = (source === undefined ? process.env.IXIS_ASSET_MODE : source) ?? "";
  return raw.trim().toLowerCase() === "live" ? "live" : "demo";
}

/** Customer-facing unit. "Ixis Coin" only in live mode. */
export function ixisUnitLabel(mode: IxisAssetMode = getIxisAssetMode()) {
  return mode === "live" ? "Ixis Coin" : "Ixis";
}
