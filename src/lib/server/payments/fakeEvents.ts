import type { Order } from "@prisma/client";
import { getEnv } from "../env";
import { randomToken } from "../crypto";
import { payments, stripe } from "./index";

/**
 * Builds Stripe-shaped events for the local fake checkout and delivers them
 * to our real webhook endpoint with a real Stripe signature. Development and
 * tests only.
 */
export interface FakeCustomer {
  email: string;
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export function fakeSession(order: Order, customer: FakeCustomer, paymentStatus: "paid" | "unpaid", status: "complete" | "expired" = "complete") {
  const address = { line1: customer.line1, line2: customer.line2 ?? null, city: customer.city, state: customer.state, postal_code: customer.postalCode, country: customer.country ?? "US" };
  return {
    id: order.stripeCheckoutSessionId,
    object: "checkout.session",
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.number },
    status,
    payment_status: paymentStatus,
    currency: "usd",
    amount_subtotal: order.subtotalCents,
    amount_total: order.totalCents,
    total_details: { amount_discount: order.discountCents, amount_shipping: order.shippingCents, amount_tax: 0 },
    customer: null,
    customer_details: { email: customer.email, name: customer.name, phone: customer.phone ?? null, address },
    collected_information: { shipping_details: { name: customer.name, address } },
    payment_intent: `pi_fake_${order.id}`,
    shipping_cost: null,
  };
}

export function fakeEvent(type: string, object: unknown) {
  return { id: `evt_fake_${randomToken(12)}`, object: "event", type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object }, api_version: "2026-08-26.dahlia" };
}

export async function deliverFakeEvent(event: object, baseUrl = getEnv().NEXT_PUBLIC_APP_URL) {
  if (getEnv().isProd) throw new Error("Fake Stripe events are disabled in production");
  const payload = JSON.stringify(event);
  const header = stripe().webhooks.generateTestHeaderString({ payload, secret: payments().webhookSecret() });
  const res = await fetch(`${baseUrl}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
  return { status: res.status, body: await res.json().catch(() => null) };
}
