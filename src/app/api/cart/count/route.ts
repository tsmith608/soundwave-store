import { NextResponse } from "next/server";
import { readCart } from "@/lib/server/cart";

/** Tiny endpoint for the header badge. */
export async function GET() {
  try {
    const cart = await readCart();
    const count = cart?.items.reduce((a, i) => a + i.quantity, 0) ?? 0;
    return NextResponse.json({ count }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
