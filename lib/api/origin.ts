/**
 * CSRF guard for cookie-authenticated POSTs. Browsers always send Origin on cross-site POSTs,
 * so a present Origin must match this deployment. Requests without Origin (server-to-server,
 * curl) must still carry a JSON content type, which a plain HTML form cannot send.
 */
export function sameOriginRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set<string>([new URL(request.url).origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // ignore a malformed env value
    }
  }
  return allowed.has(origin);
}
