import { NextResponse } from "next/server";
import { wardrobeEntitlementsFromCatalog } from "@/lib/catalog";

export async function GET(request: Request) {
  const app = new URL(request.url).searchParams.get("app")?.trim().toLowerCase() ?? "";
  if (app === "cixy") {
    return NextResponse.json({
      app: "cixy",
      entitlements: wardrobeEntitlementsFromCatalog(),
      message: "Purchased wardrobe rows are not stored yet. These essentials are always owned. Equip does not spend Ixis.",
    });
  }
  return NextResponse.json({ items: [], message: "Entitlements require auth + schema wallet." });
}
