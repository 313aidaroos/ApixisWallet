import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    currency: "Ixis",
    available: null,
    paid: null,
    bonus: null,
    reserved: null,
    rate: { xpPerDollar: 100 },
    message: "Connect Supabase auth to return the signed-in wallet. Demo UI still uses local preview numbers.",
  });
}
