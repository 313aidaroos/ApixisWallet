import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { createServiceSupabase } from "@/lib/supabase/service";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(80),
  owner_id: z.string().uuid(), // server-to-server: sister site passes the user's owner_id
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reservation" }, { status: 400 });

  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });

  // Validate Bearer token is service_role
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!authHeader || !serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== serviceKey) {
    return NextResponse.json({ error: "Invalid service key" }, { status: 401 });
  }

  const ownerId = parsed.data.owner_id;

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
