import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const app = new URL(request.url).searchParams.get("app");
  return NextResponse.json({
    entitlements: [],
    items: [],
    persisted: false,
    app: app || null,
    message:
      "Entitlement rows are not stored yet. This empty list is not a balance and not an access grant. Renoxis must quote, reserve, provision, then capture. After a real capture, renoxis.activate is active with no renewsAt, and renoxis.agent.monthly is active with renewsAt about 30 days later. See docs/RENOXIS.md.",
  });
}
