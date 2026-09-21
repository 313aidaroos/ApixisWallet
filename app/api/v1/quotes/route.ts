import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct, includedWardrobeDenial, isComingSoonCatalogItem, isWardrobeEssential, wardrobeUnlockId } from "@/lib/catalog";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid quote request" }, { status: 400 });
  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });
  const unlockAssetId = wardrobeUnlockId(product);
  if (unlockAssetId && isWardrobeEssential(product)) {
    return NextResponse.json(includedWardrobeDenial({ key: product.key, unlockAssetId }), { status: 400 });
  }
  if (product.xp == null || isComingSoonCatalogItem(product)) {
    return NextResponse.json(
      { error: "Coming soon", productKey: product.key, status: "coming_soon" },
      { status: 400 },
    );
  }
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return NextResponse.json({
    quoteId: crypto.randomUUID(),
    productKey: product.key,
    app: product.app,
    name: product.name,
    xp: product.xp,
    usdEquivalent: product.xp / 100,
    expiresAt,
    payable: "xp_only",
  });
}
