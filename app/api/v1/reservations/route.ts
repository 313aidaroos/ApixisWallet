import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { createServiceSupabase } from "@/lib/supabase/service";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(80),
  owner_id: z.string().uuid().optional(), // server-to-server: sister site passes the user's owner_id
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reservation" }, { status: 400 });

  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });

  // Auth: sister sites call with service_role + owner_id in body
  // TODO: validate Bearer token is service_role
  const ownerId = parsed.data.owner_id;
  if (!ownerId) {
    return NextResponse.json({ error: "owner_id required for server-to-server reserve" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  // Call reserve_xp via RPC
  const { data, error } = await supabase.rpc("reserve_xp", {
    p_owner_id: ownerId,
    p_amount: product.xp,
    p_description: `${product.name} (${product.app})`,
    p_external_id: parsed.data.idempotencyKey,
    p_app_slug: product.app.toLowerCase().replace(/\s+/g, ""),
  });

  if (error) {
    if (error.message.includes("Insufficient balance")) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error("reserve_xp failed:", error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      reservationId: data,
      status: "held",
      productKey: product.key,
      ixis: product.xp,
    },
    { status: 201 }
  );
}
