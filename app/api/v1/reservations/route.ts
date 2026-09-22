import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireServiceBearer } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(80),
  // Sister sites identify the customer by verified EMAIL — uids differ per Supabase project.
  // owner_id is accepted only when it is already a Wallet uid (e.g. the Wallet's own UI).
  owner_email: z.string().email().optional(),
  owner_id: z.string().uuid().optional(),
}).refine((b) => b.owner_email || b.owner_id, { message: "owner_email required" });

export async function POST(request: Request) {
  const denied = requireServiceBearer(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reservation" }, { status: 400 });

  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });


  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  let ownerId = parsed.data.owner_id ?? null;
  if (parsed.data.owner_email) {
    const r = await resolveOwnerByEmail(supabase, parsed.data.owner_email);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    ownerId = r.ownerId;
  }
  if (!ownerId) return NextResponse.json({ error: "owner_email required" }, { status: 400 });

  // Call reserve_xp via RPC
  const { data, error } = await supabase.rpc("reserve_xp", {
    p_owner_id: ownerId,
    p_amount: product.xp,
    p_description: `${product.name} (${product.app})`,
    p_external_id: parsed.data.idempotencyKey,
    p_app_slug: product.app.toLowerCase().replace(/\s+/g, ""),
    p_product_key: product.key,
  });

  if (error) {
    if (error.message.includes("Insufficient balance")) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    if (error.message.includes("wallets_owner_id_fkey")) {
      return NextResponse.json({ error: "Unknown wallet owner — send owner_email, not a sister-site uid" }, { status: 400 });
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
