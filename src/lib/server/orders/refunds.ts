import { prisma } from "../db";
import { AppError } from "../http";
import { log } from "../log";
import { payments } from "../payments";
import { enqueue } from "../jobs/queue";
import { cancelAtProvider } from "../fulfillment/service";
import { applyRefundTotals } from "./payment";
import { noteEvent, transition } from "./state";

/**
 * Issues a refund through Stripe. The Refund row is created first with a
 * unique idempotency key (derived from the order's refund count), which is
 * also sent to Stripe — so a double-click or retry can never refund twice.
 */
export async function createRefund(orderId: string, amountCents: number, reason: string, actor: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { refunds: true } });
  if (!order || !order.paidAt) throw new AppError(400, "not_paid", "Only paid orders can be refunded.");
  if (!order.stripePaymentIntentId) throw new AppError(400, "no_payment", "This order has no Stripe payment to refund.");
  const pendingOrDone = order.refunds.filter((r) => r.status !== "failed" && r.status !== "canceled").reduce((s, r) => s + r.amountCents, 0);
  const remaining = order.totalCents - Math.max(order.refundedCents, pendingOrDone);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new AppError(400, "bad_amount", "Enter an amount greater than zero.");
  if (amountCents > remaining) throw new AppError(400, "too_much", `At most ${(remaining / 100).toFixed(2)} can still be refunded.`);

  const key = `refund:${order.id}:${order.refunds.length + 1}`;
  let refund;
  try {
    refund = await prisma.refund.create({ data: { orderId, idempotencyKey: key, amountCents, reason: reason.slice(0, 500), createdBy: actor, status: "pending" } });
  } catch {
    throw new AppError(409, "in_progress", "A refund for this order was just submitted. Refresh to see it.");
  }
  try {
    const r = await payments().refund({ paymentIntentId: order.stripePaymentIntentId, amountCents, idempotencyKey: key, reason });
    const status = r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : "pending";
    await prisma.refund.update({ where: { id: refund.id }, data: { providerRefundId: r.id, status } });
    await noteEvent(orderId, "payment", actor, `Refund of ${(amountCents / 100).toFixed(2)} ${status}. Reason: ${reason || "—"}`);
    if (status === "succeeded") {
      const total = (await prisma.refund.aggregate({ where: { orderId, status: "succeeded" }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
      await prisma.$transaction((tx) => applyRefundTotals(tx, orderId, total, actor));
    }
    return { refundId: refund.id, status };
  } catch (err) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "failed", failureReason: (err as Error).message.slice(0, 500) } });
    log.error("refund_failed", { orderId, err });
    throw new AppError(502, "refund_failed", `Stripe refused the refund: ${(err as Error).message}`);
  }
}

/** Cancels an order that hasn't gone into production. Optionally refunds in full. */
export async function cancelOrder(orderId: string, opts: { refund: boolean; reason: string; actor: string }) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (["shipped", "delivered", "cancelled", "refunded"].includes(order.status)) throw new AppError(400, "too_late", `An order that is ${order.status} can't be cancelled.`);
  if (order.status === "in_production" || order.status === "submitted_to_fulfillment") {
    const ok = await cancelAtProvider(orderId);
    if (!ok) throw new AppError(409, "in_production", "The print lab has already started this order and can't cancel it. Consider a refund instead.");
  } else {
    await cancelAtProvider(orderId);
  }
  await prisma.$transaction(async (tx) => {
    await transition(tx, orderId, "cancelled", { actor: opts.actor, message: `Cancelled: ${opts.reason || "no reason given"}`, extra: { cancelledAt: new Date(), attentionReason: null } });
    await tx.job.updateMany({ where: { dedupeKey: { in: [`render_order:${orderId}`, `submit_fulfillment:${orderId}`] }, status: { in: ["queued", "failed"] } }, data: { status: "dead", lastError: "Order cancelled" } });
    if (order.paidAt) await enqueue(tx, "send_email", { template: "cancelled", orderId }, { dedupeKey: `email:cancelled:${orderId}` });
  });
  if (opts.refund && order.paidAt) {
    const remaining = order.totalCents - order.refundedCents;
    if (remaining > 0) await createRefund(orderId, remaining, opts.reason || "Order cancelled", opts.actor);
  }
}
