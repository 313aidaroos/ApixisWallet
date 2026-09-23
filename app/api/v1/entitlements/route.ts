import { NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { authenticateService, looksLikeServiceBearer } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";
import { canonicalAppSlug } from "@/lib/checkout/destinations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Active entitlements: status = active AND (renews_at is null OR renews_at > now).
 * Callers: (a) the signed-in Wallet user (cookie or Wallet access token);
 *          (b) a sister-site SERVER with its API key asking about one owner_email.
 * A per-site key only sees its own apps. Never lets a browser pick an arbitrary owner.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appParam = url.searchParams.get("app");
  const app = appParam ? canonicalAppSlug(appParam) : null;

  let userId: string | null = null;
  let apps: string[] | null = null;

  if (looksLikeServiceBearer(request)) {
    const auth = await authenticateService(request);
    if ("response" in auth) return auth.response;
    apps = auth.caller.apps;
    if (app && apps && !apps.includes(app)) {
      return NextResponse.json({ error: `This API key cannot read ${app} entitlements` }, { status: 403 });
    }
    const email = url.searchParams.get("owner_email");
    const requested = url.searchParams.get("owner_id");
    const svc = createServiceSupabase();
    if (!svc) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
    if (email) {
      const r = await resolveOwnerByEmail(svc, email, { create: false });
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      if (!r.ownerId) return NextResponse.json({ entitlements: [], persisted: false, app: app ?? undefined });
      userId = r.ownerId;
    } else if (requested && UUID.test(requested) && auth.caller.legacy) {
      userId = requested;
    } else {
      return NextResponse.json({ error: "owner_email required for service calls" }, { status: 400 });
    }
  } else {
    try {
      userId = await getRequestUserId(request);
    } catch {
      return NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 });
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  let query = supabase
    .from("entitlements")
    .select("id, owner_id, app_slug, product_key, status, renews_at, xp_price, created_at, updated_at")
    .eq("owner_id", userId)
    .eq("status", "active")
    .or(`renews_at.is.null,renews_at.gt."${new Date().toISOString()}"`);
  if (app) query = query.eq("app_slug", app);
  else if (apps) query = query.in("app_slug", apps);

  const { data, error } = await query;
  if (error) {
    console.error("entitlements query failed", { code: error.code });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      entitlements: data ?? [],
      persisted: Boolean(data && data.length > 0),
      app: app ?? undefined,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
