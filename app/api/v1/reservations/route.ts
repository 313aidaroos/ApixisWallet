import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct, includedWardrobeDenial, isComingSoonCatalogItem, isWardrobeEssential, wardrobeUnlockId } from "@/lib/catalog";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(80),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reservation" }, { status: 400 });
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
  return NextResponse.json({
    reservationId: crypto.randomUUID(),
    status: "demo_held",
    productKey: product.key,
    xp: product.xp,
    message: "Ledger reserve_xp is not live until Supabase functions are applied. This response is a contract stub.",
  }, { status: 201 });
}
