import type Stripe from "stripe";
import { handleStripeEvent } from "./orders/payment";
import { registerWebhookHandler } from "./webhooks";

/** Registers stored-event processors so admins/worker can re-run failed webhooks. */
registerWebhookHandler("stripe", (p) => handleStripeEvent(p as Stripe.Event));
registerWebhookHandler("prodigi", async (p) => {
  const { handleProdigiCallback } = await import("./fulfillment/callbacks");
  return handleProdigiCallback(p);
});
registerWebhookHandler("resend", async (p) => {
  const { handleResendEvent } = await import("./email/events");
  return handleResendEvent(p);
});
