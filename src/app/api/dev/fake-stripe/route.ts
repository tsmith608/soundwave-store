import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { getEnv } from "@/lib/server/env";
import { deliverFakeEvent, fakeEvent, fakeSession } from "@/lib/server/payments/fakeEvents";

export const dynamic = "force-dynamic";

/** Dev-only: the local fake checkout page posts here to simulate Stripe outcomes. */
export async function POST(req: NextRequest) {
  const env = getEnv();
  if (env.isProd || env.paymentsProvider !== "fake") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const form = await req.formData();
  const sessionId = String(form.get("sessionId") || "");
  const outcome = String(form.get("outcome") || "pay");
  const order = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: sessionId } });
  if (!order) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const customer = {
    email: String(form.get("email") || "test.customer@example.com"),
    name: String(form.get("name") || "Test Customer"),
    line1: String(form.get("line1") || "1 Test Street"),
    city: String(form.get("city") || "Portland"),
    state: String(form.get("state") || "OR"),
    postalCode: String(form.get("postalCode") || "97201"),
  };
  const base = req.nextUrl.origin;
  if (outcome === "pay") {
    await deliverFakeEvent(fakeEvent("checkout.session.completed", fakeSession(order, customer, "paid")), base);
    return NextResponse.redirect(`${base}/checkout/success?session_id=${sessionId}`, 303);
  }
  if (outcome === "async_fail") {
    await deliverFakeEvent(fakeEvent("checkout.session.completed", fakeSession(order, customer, "unpaid")), base);
    await deliverFakeEvent(fakeEvent("checkout.session.async_payment_failed", fakeSession(order, customer, "unpaid")), base);
    return NextResponse.redirect(`${base}/checkout/success?session_id=${sessionId}`, 303);
  }
  if (outcome === "expire") {
    await deliverFakeEvent(fakeEvent("checkout.session.expired", fakeSession(order, customer, "unpaid", "expired")), base);
  }
  return NextResponse.redirect(`${base}/cart?checkout=cancelled`, 303);
}
