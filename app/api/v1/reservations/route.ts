import { NextResponse } from "next/server";
import { z } from "zod";
import { findCatalogProduct } from "@/lib/catalog";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, callerMayUseApp } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";
import { ledgerErrorResponse } from "@/lib/api/errors";
import { IDEMPOTENCY_KEY, productApp, reserveProduct } from "@/lib/api/reserve";

const bodySchema = z.object({
  productKey: z.string().min(1).max(80),
  quoteId: z.string().uuid().optional(),
  idempotencyKey: z.string().regex(IDEMPOTENCY_KEY),
  // Sister sites identify the customer by verified EMAIL — uids differ per Supabase project.
  // owner_id is accepted only when it is already a Wallet uid (e.g. the Wallet's own UI).
  owner_email: z.string().email().max(320).optional(),
  owner_id: z.string().uuid().optional(),
}).refine((b) => b.owner_email || b.owner_id, { message: "owner_email required" });

export async function POST(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reservation (productKey, idempotencyKey 8–80 printable chars, no spaces, owner_email)" }, { status: 400 });
  }

  const product = findCatalogProduct(parsed.data.productKey);
  if (!product) return NextResponse.json({ error: "Unknown redeem SKU" }, { status: 404 });
  const app = productApp(product);
  if (!callerMayUseApp(auth.caller, app)) {
    return NextResponse.json({ error: `This API key cannot redeem ${app} products` }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  // A raw Wallet uid is only accepted from the legacy (unscoped) key; site keys identify people by email.
  if (parsed.data.owner_id && !parsed.data.owner_email && !auth.caller.legacy) {
    return NextResponse.json({ error: "owner_email required" }, { status: 400 });
  }
  let ownerId = parsed.data.owner_id ?? null;
  if (parsed.data.owner_email) {
    const r = await resolveOwnerByEmail(supabase, parsed.data.owner_email, { create: true });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    ownerId = r.ownerId;
  }
  if (!ownerId) return NextResponse.json({ error: "owner_email required" }, { status: 400 });

  const { data, error } = await reserveProduct(supabase, {
    ownerId,
    product,
    idempotencyKey: parsed.data.idempotencyKey,
    actor: auth.caller.actor,
  });
  if (error) {
    if (error.message?.includes("wallets_owner_id_fkey")) {
      return NextResponse.json({ error: "Unknown wallet owner — send owner_email, not a sister-site uid" }, { status: 400 });
    }
    return ledgerErrorResponse(error, "Reservation");
  }

  return NextResponse.json(
    {
      reservationId: data,
      status: "held",
      productKey: product.key,
      app,
      ixis: product.xp,
      xp: product.xp,
    },
    { status: 201 },
  );
}
