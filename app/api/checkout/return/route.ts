import { NextResponse } from "next/server";
import { loadCheckoutStatus } from "@/lib/checkout/load-status";
import { backRedirectTarget, returnRedirectTarget } from "@/lib/checkout/status";
import { checkoutViewer } from "@/lib/checkout/viewer";

const SESSION_ID = /^cs_[A-Za-z0-9_]{1,200}$/;

/**
 * Sends the browser to the allowlisted return_url stored on the Checkout Session.
 * Query-string return_url is ignored so this route cannot be an open redirect.
 * `?to=product` is the explicit "Back to <product>" button: it goes to the same stored, allowlisted
 * return_url without waiting for the credit (the webhook still credits the Wallet).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("session_id")?.trim() ?? "";
  const explicitBack = params.get("to") === "product";
  if (!SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  const viewer = await checkoutViewer();
  if ("response" in viewer) return viewer.response;

  const loaded = await loadCheckoutStatus(sessionId, viewer.userId);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const target = explicitBack ? backRedirectTarget(loaded.payload) : returnRedirectTarget(loaded.payload);
  if (!target) {
    return NextResponse.json(
      { error: "Ixis is still in Apixis Wallet. There is no allowlisted return yet." },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.redirect(target, 302);
}
