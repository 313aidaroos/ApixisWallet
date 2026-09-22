import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { hasServiceAuth } from "@/lib/api/service-auth";
import { resolveOwnerByEmail } from "@/lib/api/owner";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const app = url.searchParams.get("app");

  // Two callers: (a) the signed-in customer via Supabase JWT cookie;
  // (b) a sister-site SERVER holding the service key asking about one owner_id.
  // Never let a browser pick an arbitrary owner_id.
  let userId: string | null = null;
  if (hasServiceAuth(request)) {
    const email = url.searchParams.get("owner_email");
    const requested = url.searchParams.get("owner_id");
    if (email) {
      const svc = createServiceSupabase();
      if (!svc) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
      const r = await resolveOwnerByEmail(svc, email);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      userId = r.ownerId;
    } else if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
      userId = requested;
    } else {
      return NextResponse.json({ error: "owner_email (or Wallet owner_id) required for service calls" }, { status: 400 });
    }
  } else {
    userId = await getAuthenticatedUserId();
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });
  }

  let query = supabase.from("entitlements").select("*").eq("owner_id", userId);
  if (app) {
    query = query.eq("app_slug", app.toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error("entitlements query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({
    entitlements: data || [],
  });
}
