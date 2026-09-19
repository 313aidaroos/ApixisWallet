import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ items: [], nextCursor: null, message: "Ledger reads require auth + schema wallet." });
}
