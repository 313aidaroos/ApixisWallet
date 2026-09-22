import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = new URL(request.url).searchParams.get("app");

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
