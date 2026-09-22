import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Server-to-server auth for money routes (reserve / capture / release).
 *
 * Only sister-site SERVERS hold the wallet service key. Browsers never do.
 * Check the bearer BEFORE reading the body — a body field is attacker-controlled
 * and must never be what selects the wallet on an unauthenticated request.
 */
export function requireServiceBearer(request: Request): NextResponse | null {
  const expected = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  // Constant-time compare; length mismatch is itself a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
/** True only when the request carries the exact service key (constant-time). */
export function hasServiceAuth(request: Request): boolean {
  return requireServiceBearer(request) === null && !!(request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}
