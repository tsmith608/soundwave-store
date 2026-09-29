import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { log } from "@/lib/server/log";
import { handleStripeEvent } from "@/lib/server/orders/payment";
import { payments } from "@/lib/server/payments";
import { ingestWebhook } from "@/lib/server/webhooks";

export const dynamic = "force-dynamic";

/** Stripe → us. Signature-verified (Stripe SDK), deduplicated, idempotent. The only thing that marks orders paid. */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = payments().verifyWebhook(raw, sig);
  } catch (err) {
    log.warn("stripe_webhook_bad_signature", { err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const res = await ingestWebhook("stripe", event.id, event.type, event, (p) => handleStripeEvent(p as Stripe.Event));
  return NextResponse.json(res.body, { status: res.status });
}
