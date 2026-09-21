import { NextResponse } from "next/server";
import { loadCheckoutStatus } from "@/lib/checkout/load-status";
import { toPublicStatus } from "@/lib/checkout/status";
import { checkoutViewer } from "@/lib/checkout/viewer";

const SESSION_ID = /^cs_[A-Za-z0-9_]{1,200}$/;

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
  if (!SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  const viewer = await checkoutViewer();
  if ("response" in viewer) return viewer.response;

  const loaded = await loadCheckoutStatus(sessionId, viewer.userId);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  return NextResponse.json(toPublicStatus(loaded.payload), { headers: { "cache-control": "no-store" } });
}
