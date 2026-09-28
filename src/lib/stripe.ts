import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia" as any,
      typescript: true,
    })
  : null;

export const isStripeConfigured = Boolean(
  stripeSecretKey && !stripeSecretKey.includes("mock") && !stripeSecretKey.includes("placeholder")
);
