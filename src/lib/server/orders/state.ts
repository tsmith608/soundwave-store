import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";

/**
 * Order lifecycle. Every status change goes through `transition`, which
 * checks the move is allowed, updates atomically (compare-and-set on the
 * current status, so concurrent webhooks can't double-apply) and writes an
 * OrderEvent for the audit trail.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled", "failed"],
  paid: ["processing_artwork", "cancelled", "refunded"],
  processing_artwork: ["ready_for_fulfillment", "paid", "cancelled", "refunded"],
  // → delivered only for digital-only orders, whose files are the delivery.
  ready_for_fulfillment: ["submitted_to_fulfillment", "processing_artwork", "delivered", "cancelled", "refunded"],
  submitted_to_fulfillment: ["in_production", "shipped", "ready_for_fulfillment", "cancelled", "refunded"],
  in_production: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  // A late successful payment for an expired/superseded checkout is still money received.
  cancelled: ["paid", "refunded"],
  failed: ["paid", "cancelled"],
  refunded: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing_artwork: "Preparing your print file",
  ready_for_fulfillment: "Ready for printing",
  submitted_to_fulfillment: "Sent to our print studio",
  in_production: "Being printed and framed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Payment failed",
};

/** Customer-facing progress steps (index into this for a progress bar). */
export const PROGRESS: OrderStatus[] = ["paid", "processing_artwork", "submitted_to_fulfillment", "in_production", "shipped", "delivered"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {}

export async function transition(
  tx: Tx,
  orderId: string,
  to: OrderStatus,
  opts: { actor: string; message?: string; data?: Prisma.InputJsonValue; extra?: Prisma.OrderUpdateManyMutationInput; allowNoop?: boolean },
): Promise<{ changed: boolean; from: OrderStatus }> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  if (order.status === to) {
    if (opts.allowNoop !== false) return { changed: false, from: order.status };
  }
  if (!canTransition(order.status, to)) throw new TransitionError(`Order ${orderId}: ${order.status} → ${to} is not allowed`);
  const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to, ...(opts.extra ?? {}) } });
  if (res.count !== 1) throw new TransitionError(`Order ${orderId} changed concurrently`);
  await tx.orderEvent.create({ data: { orderId, type: "status_changed", fromStatus: order.status, toStatus: to, actor: opts.actor, message: opts.message, data: opts.data } });
  return { changed: true, from: order.status };
}

export async function noteEvent(orderId: string, type: string, actor: string, message: string, data?: Prisma.InputJsonValue, tx: Tx | typeof prisma = prisma) {
  await tx.orderEvent.create({ data: { orderId, type, actor, message: message.slice(0, 2000), data } });
}

export async function nextOrderNumber(tx: Tx): Promise<string> {
  const c = await tx.counter.upsert({ where: { name: "order" }, create: { name: "order", value: 10001 }, update: { value: { increment: 1 } } });
  return `${process.env.ORDER_NUMBER_PREFIX || "SW"}-${c.value}`;
}
