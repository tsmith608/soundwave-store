import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { log } from "../log";
import { enqueue } from "../jobs/queue";
import { noteEvent, transition } from "./state";

/**
 * Stripe event handlers. Each is idempotent: running it twice (duplicate or
 * out-of-order delivery, reconciliation after a missed webhook) has the same
 * effect as running it once.
 */

type Session = Stripe.Checkout.Session;

function piId(s: Session): string | null {
  return typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
}

async function findOrderForSession(tx: Tx, s: Session) {
  const id = s.metadata?.orderId || s.client_reference_id;
  const order = (id ? await tx.order.findUnique({ where: { id } }) : null) ?? (await tx.order.findUnique({ where: { stripeCheckoutSessionId: s.id } }));
  return order;
}

/** checkout.session.completed (paid) / async_payment_succeeded, or reconciliation. */
export async function markPaidFromSession(s: Session, actor = "webhook:stripe"): Promise<{ orderId: string | null; changed: boolean }> {
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") {
    const o = await prisma.$transaction((tx) => findOrderForSession(tx, s));
    if (o) await noteEvent(o.id, "payment", actor, `Checkout completed; payment is ${s.payment_status} (e.g. bank transfer pending).`);
    return { orderId: o?.id ?? null, changed: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await findOrderForSession(tx, s);
    if (!order) {
      log.error("paid_session_without_order", { sessionId: s.id });
      return { orderId: null, changed: false };
    }
    if (order.paidAt) return { orderId: order.id, changed: false };

    const cd = s.customer_details;
    const ship = s.collected_information?.shipping_details;
    const addr = ship?.address ?? cd?.address ?? null;
    const td = s.total_details;
    const paymentIntent = piId(s);
    const lateAfterCancel = order.status === "cancelled" || order.status === "failed";

    await transition(tx, order.id, "paid", {
      actor,
      message: lateAfterCancel ? "Payment received for a checkout that had been superseded or had failed — please review." : "Payment confirmed by Stripe.",
      extra: {
        paidAt: new Date(),
        email: (cd?.email || order.email || "").toLowerCase(),
        customerName: ship?.name || cd?.name || null,
        phone: cd?.phone || null,
        shipName: ship?.name || cd?.name || null,
        shipLine1: addr?.line1 ?? null,
        shipLine2: addr?.line2 ?? null,
        shipCity: addr?.city ?? null,
        shipState: addr?.state ?? null,
        shipPostalCode: addr?.postal_code ?? null,
        shipCountry: addr?.country ?? null,
        // Stripe's figures are final (tax and chosen shipping are computed there).
        subtotalCents: s.amount_subtotal ?? order.subtotalCents,
        discountCents: td?.amount_discount ?? order.discountCents,
        shippingCents: td?.amount_shipping ?? order.shippingCents,
        taxCents: td?.amount_tax ?? 0,
        totalCents: s.amount_total ?? order.totalCents,
        currency: s.currency ?? "usd",
        stripePaymentIntentId: paymentIntent,
        stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
        shippingMethod: (s.shipping_cost?.shipping_rate && typeof s.shipping_cost.shipping_rate !== "string" ? s.shipping_cost.shipping_rate.metadata?.shippingMethod : undefined) ?? order.shippingMethod,
        attentionReason: lateAfterCancel ? "paid_after_cancel" : undefined,
      },
    });

    if (paymentIntent) {
      await tx.payment.upsert({
        where: { providerPaymentId: paymentIntent },
        create: { orderId: order.id, providerPaymentId: paymentIntent, amountCents: s.amount_total ?? order.totalCents, currency: s.currency ?? "usd", status: "succeeded" },
        update: { status: "succeeded" },
      });
    }

    if (order.discountCode) {
      const d = await tx.discount.findUnique({ where: { code: order.discountCode } });
      if (d) {
        const exists = await tx.discountRedemption.findUnique({ where: { orderId: order.id } });
        if (!exists) {
          await tx.discountRedemption.create({ data: { discountId: d.id, orderId: order.id, email: (cd?.email || order.email || "").toLowerCase(), amountCents: td?.amount_discount ?? order.discountCents } });
          await tx.discount.update({ where: { id: d.id }, data: { timesRedeemed: { increment: 1 } } });
        }
      }
    }

    // The cart becomes history; its designs are now immutable purchases.
    if (order.cartId) {
      const cart = await tx.cart.findUnique({ where: { id: order.cartId }, include: { items: true } });
      if (cart && cart.status !== "converted") {
        await tx.cart.update({ where: { id: cart.id }, data: { status: "converted", convertedOrderId: order.id } });
        await tx.project.updateMany({ where: { id: { in: cart.items.map((i) => i.projectId) } }, data: { status: "ordered" } });
      }
    }
    // Recordings on paid orders are no longer "unattached": retention now follows the order (src/lib/retention.ts).
    const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { audioAssetId: true } });
    const assetIds = items.map((i) => i.audioAssetId).filter((x): x is string => Boolean(x));
    if (assetIds.length) await tx.uploadedAsset.updateMany({ where: { id: { in: assetIds } }, data: { expiresAt: null } });

    // Link to an existing verified account with the same email.
    if (!order.userId && cd?.email) {
      const user = await tx.user.findUnique({ where: { email: cd.email.toLowerCase() } });
      if (user?.emailVerifiedAt) await tx.order.update({ where: { id: order.id }, data: { userId: user.id } });
    }

    await enqueue(tx, "render_order", { orderId: order.id }, { dedupeKey: `render_order:${order.id}` });
    await enqueue(tx, "send_email", { template: "order_confirmation", orderId: order.id }, { dedupeKey: `email:order_confirmation:${order.id}` });
    return { orderId: order.id, changed: true };
  });

  if (result.changed) log.info("order_paid", { orderId: result.orderId, sessionId: s.id });
  return result;
}

export async function markAsyncPaymentFailed(s: Session) {
  await prisma.$transaction(async (tx) => {
    const order = await findOrderForSession(tx, s);
    if (!order || order.paidAt) return;
    await transition(tx, order.id, "failed", { actor: "webhook:stripe", message: "The delayed payment failed." });
    const pi = piId(s);
    if (pi) {
      await tx.payment.upsert({
        where: { providerPaymentId: pi },
        create: { orderId: order.id, providerPaymentId: pi, amountCents: s.amount_total ?? order.totalCents, currency: s.currency ?? "usd", status: "failed" },
        update: { status: "failed" },
      });
    }
    await enqueue(tx, "send_email", { template: "payment_failed", orderId: order.id }, { dedupeKey: `email:payment_failed:${order.id}` });
  });
}

export async function markSessionExpired(s: Session) {
  await prisma.$transaction(async (tx) => {
    const order = await findOrderForSession(tx, s);
    if (!order || order.status !== "pending_payment") return;
    await transition(tx, order.id, "cancelled", { actor: "webhook:stripe", message: "Checkout expired without payment.", extra: { cancelledAt: new Date() } });
    if (order.cartId) await tx.cart.updateMany({ where: { id: order.cartId, status: "checking_out" }, data: { status: "active" } });
  });
}

/** Keeps Refund rows and order totals in step with Stripe (refunds made in the Stripe dashboard included). */
export async function syncChargeRefunds(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { stripePaymentIntentId: pi } });
    if (!order) return;
    const refunds = charge.refunds?.data ?? [];
    for (const r of refunds) {
      const status = (r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : r.status === "canceled" ? "canceled" : "pending") as "succeeded" | "failed" | "canceled" | "pending";
      const existing = await tx.refund.findUnique({ where: { providerRefundId: r.id } });
      if (existing) await tx.refund.update({ where: { id: existing.id }, data: { status } });
      else await tx.refund.create({ data: { orderId: order.id, providerRefundId: r.id, idempotencyKey: `stripe:${r.id}`, amountCents: r.amount, status, createdBy: "stripe_dashboard", reason: r.reason ?? null } });
    }
    await applyRefundTotals(tx, order.id, charge.amount_refunded, "webhook:stripe");
  });
}

export async function applyRefundTotals(tx: Tx, orderId: string, refundedCents: number, actor: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (refundedCents === order.refundedCents) return;
  await tx.order.update({ where: { id: orderId }, data: { refundedCents } });
  const full = refundedCents >= order.totalCents;
  await tx.payment.updateMany({ where: { orderId }, data: { status: full ? "refunded" : "partially_refunded" } });
  await noteEvent(orderId, "payment", actor, full ? "Order fully refunded." : `Partial refund: total refunded ${(refundedCents / 100).toFixed(2)}.`, undefined, tx);
  if (full && order.status !== "refunded" && order.status !== "pending_payment") {
    await transition(tx, orderId, "refunded", { actor, message: "Full refund issued." });
    await enqueue(tx, "send_email", { template: "refund", orderId }, { dedupeKey: `email:refund_full:${orderId}` });
  } else if (!full) {
    await enqueue(tx, "send_email", { template: "refund", orderId, refundedCents }, { dedupeKey: `email:refund:${orderId}:${refundedCents}` });
  }
}

export async function flagDispute(dispute: Stripe.Dispute) {
  const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!pi) return;
  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: pi } });
  if (!order) return;
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { attentionReason: "dispute" } }),
    prisma.payment.updateMany({ where: { orderId: order.id }, data: { status: "disputed" } }),
    prisma.orderEvent.create({ data: { orderId: order.id, type: "payment", actor: "webhook:stripe", message: `Chargeback/dispute opened (${dispute.reason}). Respond in the Stripe dashboard.`, data: { disputeId: dispute.id } as Prisma.InputJsonValue } }),
  ]);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "ignored"> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await markPaidFromSession(event.data.object as Session);
      return "processed";
    case "checkout.session.async_payment_failed":
      await markAsyncPaymentFailed(event.data.object as Session);
      return "processed";
    case "checkout.session.expired":
      await markSessionExpired(event.data.object as Session);
      return "processed";
    case "charge.refunded":
      await syncChargeRefunds(event.data.object as Stripe.Charge);
      return "processed";
    case "charge.dispute.created":
      await flagDispute(event.data.object as Stripe.Dispute);
      return "processed";
    case "payment_intent.payment_failed": {
      // Card declines inside hosted Checkout are retried by the customer there — record, don't email.
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.orderId;
      if (orderId && (await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })))
        await noteEvent(orderId, "payment", "webhook:stripe", `Payment attempt declined: ${pi.last_payment_error?.message ?? "unknown reason"}`);
      return "processed";
    }
    default:
      return "ignored";
  }
}
