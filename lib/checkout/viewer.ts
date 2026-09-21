import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

export async function checkoutViewer(): Promise<{ userId: string } | { response: NextResponse }> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
    return { userId };
  } catch {
    return { response: NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 }) };
  }
}
