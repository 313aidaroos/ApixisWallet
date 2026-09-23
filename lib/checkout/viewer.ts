import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function checkoutViewer(): Promise<{ userId: string; email: string | null } | { response: NextResponse }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
    return { userId: user.id, email: user.email };
  } catch {
    return { response: NextResponse.json({ error: "Supabase auth is not configured" }, { status: 503 }) };
  }
}
