import type { Fulfillment, Order } from "@prisma/client";
import { prisma } from "../db";
import { getEnv } from "../env";
import { log } from "../log";
import { enqueue, PermanentJobError } from "../jobs/queue";
import { storage } from "../storage";
import { noteEvent, transition } from "../orders/state";
import { fulfillmentProvider, ProviderError, type ProviderOrderState } from "./index";

const PROVIDER_SHIPPING: Record<string, string> = { standard: "Standard", express: "Express" };

/**
 * Job: send a ready order to the print lab. Idempotent at three levels:
 *  - one Fulfillment row per order (unique idempotency key),
 *  - skip if the row already has a provider order id,
 *  - the same idempotency key is sent to the provider, so a retry after a
 *    timeout can never create a second print order.
 * On failure the paid order is kept, the error recorded and surfaced in admin.
 */
export async function submitFulfillment(orderId: string) {
  const env = getEnv();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true, generatedAssets: { orderBy: { createdAt: "desc" } } } }, fulfillments: true } });
  if (!order) throw new PermanentJobError(`Order ${orderId} not found`);
  const provider = await fulfillmentProvider();
  const existing = order.fulfillments.find((f) => f.status !== "cancelled");
  if (existing?.providerOrderId) {
    log.info("fulfillment_already_submitted", { orderId, providerOrderId: existing.providerOrderId });
    return;
  }
  if (order.status !== "ready_for_fulfillment") {
    log.info("fulfillment_skipped", { orderId, status: order.status });
    return;
  }
  const missing = [!order.shipLine1 && "address", !order.shipCity && "city", !order.shipPostalCode && "postal code", !order.shipCountry && "country", !order.shipName && "name"].filter(Boolean);
  if (missing.length) return failHard(order, existing ?? null, provider.name, `Shipping details incomplete: ${missing.join(", ")}`);

  const fulfillment =
    existing ??
    (await prisma.fulfillment.create({ data: { orderId, provider: provider.name, idempotencyKey: `order-${order.number}-${order.id.slice(-6)}`, shippingMethod: order.shippingMethod } }));
  await prisma.fulfillment.update({ where: { id: fulfillment.id }, data: { status: "submitting", attempts: { increment: 1 } } });

  const store = await storage();
  const items = [];
  for (const it of order.items) {
    const png = it.generatedAssets.find((a) => a.kind === "print_png");
    if (!png) return failHard(order, fulfillment, provider.name, `Item ${it.id} has no print file`);
    const attrsCfg = (it.variant.fulfillmentAttributes ?? {}) as { frameColorAttribute?: string; frameColors?: Record<string, string>; [k: string]: unknown };
    const attributes: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrsCfg)) if (typeof v === "string" && k !== "frameColorAttribute") attributes[k] = v;
    if (it.frameFinish && attrsCfg.frameColorAttribute) attributes[attrsCfg.frameColorAttribute] = attrsCfg.frameColors?.[it.frameFinish] ?? it.frameFinish;
    items.push({
      merchantReference: it.id,
      sku: it.variant.fulfillmentSku,
      copies: it.quantity,
      attributes,
      // 7-day signed URL: long enough for the lab to download, never public.
      assetUrl: await store.presignGet(png.storageKey, { expiresIn: 7 * 24 * 3600 }),
    });
  }

  try {
    const state = await provider.createOrder({
      idempotencyKey: fulfillment.idempotencyKey,
      merchantReference: order.number,
      shippingMethod: PROVIDER_SHIPPING[order.shippingMethod] ?? env.PRODIGI_SHIPPING_METHOD,
      recipient: {
        name: order.shipName!,
        email: order.email || null,
        phone: order.phone,
        address: { line1: order.shipLine1!, line2: order.shipLine2, city: order.shipCity!, state: order.shipState, postalCode: order.shipPostalCode!, countryCode: order.shipCountry! },
      },
      items,
      callbackUrl: provider.name === "prodigi" && env.PRODIGI_CALLBACK_SECRET ? `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/prodigi?token=${encodeURIComponent(env.PRODIGI_CALLBACK_SECRET)}` : undefined,
    });
    await prisma.$transaction(async (tx) => {
      await tx.fulfillment.update({
        where: { id: fulfillment.id },
        data: { providerOrderId: state.providerOrderId, status: "submitted", providerStatus: state.providerStatus, submittedAt: new Date(), lastSyncedAt: new Date(), lastError: null, costCents: state.costCents, costCurrency: state.costCurrency },
      });
      await transition(tx, orderId, "submitted_to_fulfillment", { actor: "worker", message: `Sent to ${provider.name} as ${state.providerOrderId}.`, extra: { attentionReason: null } });
      // Safety net in case a lab callback is lost.
      await enqueue(tx, "sync_fulfillment", { fulfillmentId: fulfillment.id }, { dedupeKey: `sync_fulfillment:${fulfillment.id}`, runAt: new Date(Date.now() + 30 * 60_000) });
    });
    log.info("fulfillment_submitted", { orderId, providerOrderId: state.providerOrderId });
  } catch (err) {
    const retryable = err instanceof ProviderError ? err.retryable : true;
    const message = (err as Error).message;
    await prisma.fulfillment.update({ where: { id: fulfillment.id }, data: { status: "failed", lastError: message.slice(0, 2000) } });
    await prisma.order.update({ where: { id: orderId }, data: { attentionReason: "fulfillment_failed" } });
    await noteEvent(orderId, "fulfillment", "worker", `Submission to ${provider.name} failed${retryable ? " (will retry)" : ""}: ${message}`);
    if (!retryable) throw new PermanentJobError(message);
    throw err;
  }
}

async function failHard(order: Order, f: Fulfillment | null, provider: string, message: string): Promise<never> {
  if (f) await prisma.fulfillment.update({ where: { id: f.id }, data: { status: "failed", lastError: message } });
  else await prisma.fulfillment.create({ data: { orderId: order.id, provider, idempotencyKey: `order-${order.number}-${order.id.slice(-6)}`, status: "failed", lastError: message } });
  await prisma.order.update({ where: { id: order.id }, data: { attentionReason: "fulfillment_failed" } });
  await noteEvent(order.id, "fulfillment", "worker", message);
  throw new PermanentJobError(message);
}

/** Job: pull the latest state from the lab (callbacks can be lost or arrive out of order). */
export async function syncFulfillment(fulfillmentId: string) {
  const f = await prisma.fulfillment.findUnique({ where: { id: fulfillmentId } });
  if (!f?.providerOrderId || ["complete", "cancelled"].includes(f.status)) return;
  const state = await (await fulfillmentProvider()).getOrder(f.providerOrderId);
  await applyProviderState(f.id, state, "sync");
  const fresh = await prisma.fulfillment.findUniqueOrThrow({ where: { id: f.id } });
  if (!["complete", "cancelled"].includes(fresh.status)) {
    await enqueue(prisma, "sync_fulfillment", { fulfillmentId: f.id }, { dedupeKey: `sync_fulfillment:${f.id}`, runAt: new Date(Date.now() + 6 * 3600_000) });
  }
}

/** Applies a provider snapshot. Order-independent and idempotent: status only moves forward. */
export async function applyProviderState(fulfillmentId: string, state: ProviderOrderState, source: "callback" | "sync") {
  const actor = `fulfillment:${source}`;
  await prisma.$transaction(async (tx) => {
    const f = await tx.fulfillment.findUniqueOrThrow({ where: { id: fulfillmentId }, include: { order: true } });
    const order = f.order;
    await tx.fulfillment.update({ where: { id: f.id }, data: { providerStatus: state.providerStatus, lastSyncedAt: new Date(), costCents: state.costCents ?? f.costCents, costCurrency: state.costCurrency ?? f.costCurrency } });

    if (state.issues.length) {
      await tx.fulfillment.update({ where: { id: f.id }, data: { lastError: state.issues.join("; ").slice(0, 2000) } });
      if (order.attentionReason !== "fulfillment_issue") {
        await tx.order.update({ where: { id: order.id }, data: { attentionReason: "fulfillment_issue" } });
        await noteEvent(order.id, "fulfillment", actor, `Lab reported: ${state.issues.join("; ")}`, undefined, tx);
      }
    }

    if (state.status === "cancelled") {
      if (f.status !== "cancelled") {
        await tx.fulfillment.update({ where: { id: f.id }, data: { status: "cancelled" } });
        await tx.order.update({ where: { id: order.id }, data: { attentionReason: "fulfillment_cancelled" } });
        await noteEvent(order.id, "fulfillment", actor, "The print lab cancelled this order. Review and resubmit or refund.", undefined, tx);
      }
      return;
    }

    if (state.status === "in_production" && f.status === "submitted") {
      await tx.fulfillment.update({ where: { id: f.id }, data: { status: "in_production" } });
      if (order.status === "submitted_to_fulfillment") {
        await transition(tx, order.id, "in_production", { actor });
        await enqueue(tx, "send_email", { template: "in_production", orderId: order.id }, { dedupeKey: `email:in_production:${order.id}` });
      }
    }

    for (const s of state.shipments) {
      const saved = await tx.shipment.upsert({
        where: { fulfillmentId_providerShipmentId: { fulfillmentId: f.id, providerShipmentId: s.id } },
        create: { orderId: order.id, fulfillmentId: f.id, providerShipmentId: s.id, carrier: s.carrier, service: s.service, trackingNumber: s.trackingNumber, trackingUrl: s.trackingUrl, shippedAt: s.shippedAt ?? new Date(), status: s.delivered ? "delivered" : "shipped", deliveredAt: s.delivered ? new Date() : null },
        update: { carrier: s.carrier, service: s.service, trackingNumber: s.trackingNumber, trackingUrl: s.trackingUrl, ...(s.delivered ? { status: "delivered" } : {}) },
      });
      if (s.delivered && !saved.deliveredAt) await tx.shipment.update({ where: { id: saved.id }, data: { deliveredAt: new Date() } });
      await enqueue(tx, "send_email", { template: "shipped", orderId: order.id, shipmentId: saved.id }, { dedupeKey: `email:shipped:${saved.id}` });
    }

    if (state.shipments.length) {
      const next = state.status === "complete" ? "complete" : "shipped";
      if (f.status !== next) await tx.fulfillment.update({ where: { id: f.id }, data: { status: next } });
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
      if (current.status === "submitted_to_fulfillment" || current.status === "in_production") await transition(tx, order.id, "shipped", { actor, message: "Shipped by the print lab." });
      if (state.shipments.every((s) => s.delivered)) {
        const cur2 = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
        if (cur2.status === "shipped") {
          await transition(tx, order.id, "delivered", { actor, message: "Carrier reports delivered." });
          await enqueue(tx, "send_email", { template: "delivered", orderId: order.id }, { dedupeKey: `email:delivered:${order.id}` });
        }
      }
    } else if (state.status === "complete" && f.status !== "complete") {
      await tx.fulfillment.update({ where: { id: f.id }, data: { status: "complete" } });
    }
  });
}

/** Admin: cancel at the lab if possible (only before production starts). */
export async function cancelAtProvider(orderId: string): Promise<boolean> {
  const f = await prisma.fulfillment.findFirst({ where: { orderId, status: { in: ["submitted", "submitting", "pending", "failed"] } } });
  if (!f) return true;
  if (!f.providerOrderId) {
    await prisma.fulfillment.update({ where: { id: f.id }, data: { status: "cancelled" } });
    return true;
  }
  const ok = await (await fulfillmentProvider()).cancelOrder(f.providerOrderId);
  if (ok) await prisma.fulfillment.update({ where: { id: f.id }, data: { status: "cancelled" } });
  return ok;
}
