import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { orderUrl } from "@/lib/server/orders/access";

/**
 * Polled by the checkout success page. Holding the Checkout Session id (only
 * ever given to the paying browser by Stripe's redirect) is the capability.
 * Reports what the webhook has confirmed — it never confirms anything itself.
 */
export const GET = route(async (req) => {
  const sid = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) return NextResponse.json({ found: false }, { status: 404 });
  const o = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: sid }, select: { id: true, number: true, status: true, paidAt: true, email: true } });
  if (!o) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json(
    { found: true, number: o.number, status: o.status, paid: Boolean(o.paidAt), email: o.paidAt ? o.email : null, url: o.paidAt ? orderUrl(o.id) : null },
    { headers: { "cache-control": "no-store" } },
  );
});
