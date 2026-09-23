import { NextResponse } from "next/server";

type RpcError = { code?: string; message?: string } | null | undefined;

/**
 * Map a ledger function error (custom SQLSTATEs from migration 007) to an HTTP response.
 * Anything unrecognised is logged and returned as a generic 500 — never leak SQL text.
 */
export function ledgerErrorResponse(error: RpcError, context: string) {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "WA402" || message.includes("Insufficient balance")) {
    return NextResponse.json({ error: message || "Insufficient Ixis", code: "insufficient_balance" }, { status: 402 });
  }
  if (code === "WA404" || /not found/i.test(message)) {
    return NextResponse.json({ error: "Reservation not found", code: "not_found" }, { status: 404 });
  }
  if (code === "WA409") {
    const settled = /already captured/i.test(message) ? "already_captured" : /already released/i.test(message) ? "already_released" : "conflict";
    return NextResponse.json({ error: message, code: settled }, { status: 409 });
  }
  if (code === "WA400") {
    return NextResponse.json({ error: message, code: "invalid" }, { status: 400 });
  }
  console.error(`${context} failed`, { code, message });
  return NextResponse.json({ error: `${context} failed` }, { status: 500 });
}
