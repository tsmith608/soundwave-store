import Stripe from "stripe";
import crypto from "crypto";

/** Re-sends a stored Stripe event with a fresh valid signature (same secret derivation as the fake provider). */
export async function deliverFakeEventRaw(base: string, payload: unknown) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || `whsec_${crypto.createHmac("sha256", `${process.env.APP_SECRET || "dev-only-secret-do-not-use-in-production-000000"}:webhook`).update("fake-stripe").digest("base64url").slice(0, 32)}`;
  const body = JSON.stringify(payload);
  const header = new Stripe("sk_test_unused").webhooks.generateTestHeaderString({ payload: body, secret });
  const res = await fetch(`${base}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body });
  return { status: res.status, body: (await res.json().catch(() => null)) as { duplicate?: boolean } | null };
}
