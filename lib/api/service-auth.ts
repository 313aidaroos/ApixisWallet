import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

/**
 * Server-to-server auth for the money routes (reserve / capture / release / entitlements).
 *
 * Two kinds of bearer are accepted:
 *  1. Per-site API key `apx_live_…` / `apx_test_…` (preferred). Stored hashed in
 *     public.wallet_api_clients and scoped to `app_slugs`: a Renoxis key can only reserve Renoxis
 *     SKUs and only settle Renoxis holds. Create with `npx tsx scripts/create-api-key.ts`.
 *  2. Legacy: the Wallet's Supabase service key (what sister sites were given before per-site keys).
 *     Unscoped. Accepted while WALLET_ALLOW_LEGACY_SERVICE_KEY is not "false". Turn it off once
 *     every site has its own key.
 *
 * Check the bearer BEFORE reading the body — the body is attacker-controlled.
 */

export type ServiceCaller = {
  /** Recorded on ledger rows as `actor`. */
  actor: string;
  /** Apps this caller may touch. null = every app (legacy key only). */
  apps: string[] | null;
  legacy: boolean;
  /** wallet_api_clients.id for per-site keys; null for the legacy key. */
  clientId: string | null;
  /** Once true (migration 009), this site may only act for users who signed in through Apixis ID. */
  requireSso: boolean;
};

export const API_KEY_PATTERN = /^apx_(live|test)_[A-Za-z0-9_-]{32,64}$/;

export function hashApiKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function legacyServiceKeyAllowed() {
  return (process.env.WALLET_ALLOW_LEGACY_SERVICE_KEY ?? "true").trim().toLowerCase() !== "false";
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** Returns the caller, or a ready 401/503 response. */
export async function authenticateService(
  request: Request,
): Promise<{ caller: ServiceCaller } | { response: NextResponse }> {
  const token = bearer(request);
  if (!token) return { response: unauthorized() };

  if (API_KEY_PATTERN.test(token)) {
    const supabase = createServiceSupabase();
    if (!supabase) return { response: NextResponse.json({ error: "Service configuration missing" }, { status: 503 }) };
    const { data, error } = await supabase
      .from("wallet_api_clients")
      .select("*")
      .eq("key_hash", hashApiKey(token))
      .maybeSingle();
    if (error) {
      console.error("api key lookup failed", { code: error.code });
      return { response: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
    }
    if (!data || !data.active || !Array.isArray(data.app_slugs) || data.app_slugs.length === 0) {
      return { response: unauthorized() };
    }
    void supabase.from("wallet_api_clients").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(
      () => undefined,
      () => undefined,
    );
    return {
      caller: {
        actor: `key:${data.name}`,
        apps: data.app_slugs as string[],
        legacy: false,
        clientId: data.id as string,
        requireSso: data.require_sso === true,
      },
    };
  }

  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { response: NextResponse.json({ error: "Service configuration missing" }, { status: 503 }) };
  if (legacyServiceKeyAllowed() && sameSecret(token, serviceKey)) {
    return { caller: { actor: "legacy-service-key", apps: null, legacy: true, clientId: null, requireSso: false } };
  }
  return { response: unauthorized() };
}

/** True when the request carries any bearer that could be a service credential. */
export function hasBearer(request: Request) {
  return bearer(request).length > 0;
}

/** Bearer that looks like a service credential (per-site key or a non-JWT secret), not a user JWT. */
export function looksLikeServiceBearer(request: Request) {
  const token = bearer(request);
  if (!token) return false;
  if (API_KEY_PATTERN.test(token)) return true;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(serviceKey) && sameSecret(token, serviceKey as string);
}

export function callerMayUseApp(caller: ServiceCaller, app: string) {
  return caller.apps === null || caller.apps.includes(app);
}
