import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateService } from "@/lib/api/service-auth";
import { createServiceSupabase } from "@/lib/supabase/service";
import { SSO_CODE_PATTERN, hashSsoCode } from "@/lib/sso";
import { LIMITS, checkLimits } from "@/lib/api/rate-limit";
import { ensureSignupGrant } from "@/lib/signup-grant";

const bodySchema = z.object({ code: z.string().regex(SSO_CODE_PATTERN), redirect_uri: z.string().url().max(500) });

/**
 * Exchange an Apixis ID code for the person's identity. Server-to-server only, with the site's own
 * apx_ key (the legacy shared key has no client identity and is refused). Single use.
 */
export async function POST(request: Request) {
  const auth = await authenticateService(request);
  if ("response" in auth) return auth.response;
  if (!auth.caller.clientId) {
    return NextResponse.json({ error: "Use this site's own apx_ key for Apixis ID" }, { status: 403 });
  }
  const limited = checkLimits([{ key: `sso:${auth.caller.clientId}`, ...LIMITS.ssoToken }]);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Service configuration missing" }, { status: 503 });

  const { data, error } = await supabase.rpc("consume_sso_code", {
    p_code_hash: hashSsoCode(parsed.data.code),
    p_client_id: auth.caller.clientId,
    p_redirect_uri: parsed.data.redirect_uri,
  });
  if (error) {
    console.error("sso token exchange failed", { code: error.code });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.user_id) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });

  // Apixis ID welcome grant (1,000 bonus Ixis, once) for people arriving through a product with a live
  // Wallet session. No-op unless SIGNUP_GRANT_ENABLED; never fails the exchange. The caller here is the
  // product's server, so there is no end-user IP (domain/global limits still apply).
  await ensureSignupGrant(supabase, row.user_id, { source: "sso_token", ip: null, userAgent: null, actor: auth.caller.actor });

  return NextResponse.json(
    { sub: row.user_id, email: row.email, email_verified: true },
    { headers: { "cache-control": "no-store" } },
  );
}
