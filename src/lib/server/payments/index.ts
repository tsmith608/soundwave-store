import Stripe from "stripe";
import { getEnv } from "../env";
import { hmac, randomToken } from "../crypto";

/**
 * Payment provider. Production uses Stripe Checkout (cards, Apple Pay,
 * Google Pay and Link are offered automatically by Stripe based on device and
 * dashboard settings). Development without keys uses a local fake whose
 * webhooks are real Stripe-format events signed with the same scheme, so
 * the webhook handler under test is the production one.
 */
export interface CheckoutLine {
  name: string;
  description?: string;
  unitAmountCents: number;
  quantity: number;
  metadata: Record<string, string>;
}

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: string;
  email?: string | null;
  lines: CheckoutLine[];
  discount?: { code: string; amountOffCents: number } | null;
  shipping: { id: string; label: string; amountCents: number; minBusinessDays: number; maxBusinessDays: number }[];
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentsProvider {
  readonly name: "stripe" | "fake";
  createCheckoutSession(input: CreateCheckoutInput): Promise<{ id: string; url: string; expiresAt: Date }>;
  expireCheckoutSession(id: string): Promise<void>;
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session | null>;
  refund(input: { paymentIntentId: string; amountCents: number; idempotencyKey: string; reason?: string }): Promise<{ id: string; status: string }>;
  verifyWebhook(rawBody: string, signature: string): Stripe.Event;
  webhookSecret(): string;
}

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeClient) {
    const key = getEnv().STRIPE_SECRET_KEY || "sk_test_local_fake_key_not_used_for_api_calls";
    stripeClient = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "soundwave-store" } });
  }
  return stripeClient;
}

class StripeProvider implements PaymentsProvider {
  readonly name = "stripe" as const;

  async createCheckoutSession(input: CreateCheckoutInput) {
    const e = getEnv();
    const s = stripe();
    let couponId: string | undefined;
    if (input.discount && input.discount.amountOffCents > 0) {
      const coupon = await s.coupons.create(
        { amount_off: input.discount.amountOffCents, currency: "usd", duration: "once", max_redemptions: 1, name: input.discount.code.slice(0, 40) },
        { idempotencyKey: `coupon:${input.orderId}` },
      );
      couponId = coupon.id;
    }
    const expiresAt = new Date(Date.now() + 31 * 60_000); // Stripe minimum is 30 minutes
    const session = await s.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: input.orderId,
        customer_email: input.email || undefined,
        customer_creation: "if_required",
        billing_address_collection: "auto",
        phone_number_collection: { enabled: true },
        shipping_address_collection: { allowed_countries: e.SHIPPING_COUNTRIES as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] },
        shipping_options: input.shipping.map((m) => ({
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: m.label,
            fixed_amount: { amount: m.amountCents, currency: "usd" },
            tax_behavior: "exclusive",
            delivery_estimate: { minimum: { unit: "business_day", value: m.minBusinessDays }, maximum: { unit: "business_day", value: m.maxBusinessDays } },
            metadata: { shippingMethod: m.id },
          },
        })),
        line_items: input.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: "usd",
            unit_amount: l.unitAmountCents,
            tax_behavior: "exclusive",
            product_data: { name: l.name, description: l.description, tax_code: e.STRIPE_TAX_CODE, metadata: l.metadata },
          },
        })),
        discounts: couponId ? [{ coupon: couponId }] : undefined,
        automatic_tax: { enabled: e.STRIPE_TAX_ENABLED },
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
        payment_intent_data: { metadata: { orderId: input.orderId, orderNumber: input.orderNumber }, description: `Order ${input.orderNumber}` },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      },
      { idempotencyKey: `checkout_session:${input.orderId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { id: session.id, url: session.url, expiresAt };
  }

  async expireCheckoutSession(id: string) {
    try {
      await stripe().checkout.sessions.expire(id);
    } catch {
      /* already completed or expired */
    }
  }

  async retrieveCheckoutSession(id: string) {
    try {
      return await stripe().checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
    } catch {
      return null;
    }
  }

  async refund(input: { paymentIntentId: string; amountCents: number; idempotencyKey: string; reason?: string }) {
    const r = await stripe().refunds.create(
      { payment_intent: input.paymentIntentId, amount: input.amountCents, reason: "requested_by_customer", metadata: { note: (input.reason ?? "").slice(0, 400) } },
      { idempotencyKey: input.idempotencyKey },
    );
    return { id: r.id, status: r.status ?? "pending" };
  }

  webhookSecret() {
    return getEnv().STRIPE_WEBHOOK_SECRET!;
  }

  verifyWebhook(rawBody: string, signature: string) {
    return stripe().webhooks.constructEvent(rawBody, signature, this.webhookSecret(), 300);
  }
}

/** Local stand-in for Stripe Checkout. Never available in production (see env.ts). */
class FakeProvider extends StripeProvider {
  // @ts-expect-error narrowing the readonly name for the fake
  readonly name = "fake" as const;

  async createCheckoutSession(input: CreateCheckoutInput) {
    const id = `cs_fake_${randomToken(12)}`;
    return { id, url: `${getEnv().NEXT_PUBLIC_APP_URL}/dev/checkout/${id}`, expiresAt: new Date(Date.now() + 31 * 60_000) };
  }
  async expireCheckoutSession() {}
  async retrieveCheckoutSession() {
    return null;
  }
  async refund(input: { idempotencyKey: string }) {
    return { id: `re_fake_${hmac(input.idempotencyKey, "fake-refund").slice(0, 16)}`, status: "succeeded" };
  }
  webhookSecret() {
    return getEnv().STRIPE_WEBHOOK_SECRET || `whsec_${hmac("fake-stripe", "webhook").slice(0, 32)}`;
  }
}

let provider: PaymentsProvider | null = null;
export function payments(): PaymentsProvider {
  if (!provider) provider = getEnv().paymentsProvider === "stripe" ? new StripeProvider() : new FakeProvider();
  return provider;
}
