import { prisma } from "../db";
import { PermanentJobError } from "../jobs/queue";
import { deliver } from "./send";
import * as T from "./templates";

export interface EmailJob {
  template: "order_confirmation" | "payment_failed" | "in_production" | "shipped" | "delivered" | "refund" | "cancelled";
  orderId: string;
  shipmentId?: string;
  refundedCents?: number;
}

/** Job handler: renders from current DB state and sends once (dedupe key per event). */
export async function sendOrderEmail(job: EmailJob, dedupeKey: string) {
  const order = await prisma.order.findUnique({ where: { id: job.orderId }, include: { items: { include: { variant: true } } } });
  if (!order) throw new PermanentJobError(`Order ${job.orderId} not found`);
  if (!order.email) throw new PermanentJobError(`Order ${order.number} has no email address`);
  let r: T.Rendered;
  switch (job.template) {
    case "order_confirmation": {
      const lead = { min: Math.max(...order.items.map((i) => i.variant.leadTimeMinDays)), max: Math.max(...order.items.map((i) => i.variant.leadTimeMaxDays)) };
      r = T.orderConfirmation(order, lead);
      break;
    }
    case "payment_failed":
      r = T.paymentFailed(order);
      break;
    case "in_production":
      r = T.inProduction(order);
      break;
    case "shipped": {
      const s = await prisma.shipment.findUnique({ where: { id: job.shipmentId ?? "" } });
      if (!s) throw new PermanentJobError("Shipment not found");
      r = T.shipped(order, s);
      break;
    }
    case "delivered":
      r = T.delivered(order);
      break;
    case "refund":
      r = T.refund(order, job.refundedCents ?? order.refundedCents);
      break;
    case "cancelled":
      r = T.cancelled(order);
      break;
    default:
      throw new PermanentJobError(`Unknown template ${(job as EmailJob).template}`);
  }
  await deliver({ dedupeKey, template: job.template, to: order.email, subject: r.subject, html: r.html, text: r.text, orderId: order.id });
}
