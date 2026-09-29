"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { AppError } from "@/lib/server/http";
import { enqueue } from "@/lib/server/jobs/queue";
import { cancelOrder, createRefund } from "@/lib/server/orders/refunds";
import { noteEvent, transition } from "@/lib/server/orders/state";
import { removeRecording } from "@/lib/server/orders/takedown";
import { deleteAssetBytes } from "@/lib/server/media";
import { normaliseCode } from "@/lib/commerce";

/**
 * Admin mutations. Server Actions are POST-only with Next's built-in origin
 * check (CSRF). Every action re-verifies the admin session and is audited.
 */
export type ActionResult = { ok: boolean; message: string };

async function admin() {
  const u = await requireAdmin();
  if (!u) throw new Error("Not authorised");
  return u;
}

async function audit(actor: string, action: string, targetType: string, targetId: string, data?: Prisma.InputJsonValue) {
  const h = await headers();
  await prisma.auditEvent.create({ data: { actor, action, targetType, targetId, data, ip: (h.get("x-forwarded-for") ?? "").split(",")[0] || null } });
}

async function run(fn: () => Promise<string>, paths: string[]): Promise<ActionResult> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: e instanceof AppError || e instanceof Error ? e.message : "Failed" };
  }
}

async function requireConfirm(orderId: string, typed: string) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { number: true } });
  if (typed.trim().toUpperCase() !== o.number) throw new Error(`Type the order number (${o.number}) to confirm.`);
}

export async function retryFulfillmentAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { generatedAssets: true } }, fulfillments: true } });
    const rendered = o.items.every((i) => i.generatedAssets.some((a) => a.kind === "print_png"));
    await prisma.fulfillment.updateMany({ where: { orderId, status: "failed", providerOrderId: null }, data: { status: "pending", lastError: null } });
    await prisma.order.update({ where: { id: orderId }, data: { attentionReason: null } });
    if (!rendered || ["paid", "processing_artwork"].includes(o.status)) await enqueue(prisma, "render_order", { orderId }, { dedupeKey: `render_order:${orderId}` });
    else if (o.status === "ready_for_fulfillment") await enqueue(prisma, "submit_fulfillment", { orderId }, { dedupeKey: `submit_fulfillment:${orderId}` });
    else throw new Error(`Nothing to retry for an order that is ${o.status}.`);
    await audit(u.email, "retry_fulfillment", "order", orderId);
    await noteEvent(orderId, "note", `admin:${u.email}`, "Retry requested.");
    return "Queued. The worker will pick it up within a few seconds.";
  }, [`/admin/orders/${orderId}`]);
}

export async function rerenderAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!["paid", "processing_artwork", "ready_for_fulfillment"].includes(o.status)) throw new Error("Print files can only be re-rendered before the order is sent to the lab.");
    await enqueue(prisma, "render_order", { orderId, force: true }, { dedupeKey: `render_order:${orderId}` });
    await audit(u.email, "rerender", "order", orderId);
    return "Re-render queued. Previous files are kept; the newest is sent to the lab.";
  }, [`/admin/orders/${orderId}`]);
}

export async function resendConfirmationAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await enqueue(prisma, "send_email", { template: "order_confirmation", orderId }, { dedupeKey: `email:order_confirmation:${orderId}:resend:${Date.now()}` });
    await audit(u.email, "resend_confirmation", "order", orderId);
    return "Confirmation email queued.";
  }, [`/admin/orders/${orderId}`]);
}

export async function syncFulfillmentAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const f = await prisma.fulfillment.findFirst({ where: { orderId, providerOrderId: { not: null } } });
    if (!f) throw new Error("This order hasn't been submitted to the lab yet.");
    await enqueue(prisma, "sync_fulfillment", { fulfillmentId: f.id }, { dedupeKey: `sync_fulfillment:${f.id}` });
    await prisma.job.updateMany({ where: { dedupeKey: `sync_fulfillment:${f.id}`, status: { in: ["queued", "failed"] } }, data: { runAt: new Date() } });
    await audit(u.email, "sync_fulfillment", "order", orderId);
    return "Sync queued.";
  }, [`/admin/orders/${orderId}`]);
}

export async function refundAction(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await requireConfirm(orderId, String(form.get("confirm") ?? ""));
    const amount = Math.round(Number(String(form.get("amount") ?? "0").replace(/[^0-9.]/g, "")) * 100);
    const reason = String(form.get("reason") ?? "").slice(0, 500);
    const r = await createRefund(orderId, amount, reason, `admin:${u.email}`);
    await audit(u.email, "refund", "order", orderId, { amountCents: amount, reason, status: r.status });
    return `Refund ${r.status}.`;
  }, [`/admin/orders/${orderId}`, "/admin/refunds"]);
}

export async function cancelAction(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await requireConfirm(orderId, String(form.get("confirm") ?? ""));
    const refund = form.get("refund") === "on";
    const reason = String(form.get("reason") ?? "").slice(0, 500);
    await cancelOrder(orderId, { refund, reason, actor: `admin:${u.email}` });
    await audit(u.email, "cancel", "order", orderId, { refund, reason });
    return refund ? "Order cancelled and refunded." : "Order cancelled.";
  }, [`/admin/orders/${orderId}`]);
}

export async function removeRecordingAction(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await requireConfirm(orderId, String(form.get("confirm") ?? ""));
    await removeRecording(orderId, { apply: true, actor: `admin:${u.email}` });
    await audit(u.email, "remove_recording", "order", orderId);
    return "Recording deleted; the QR code now says it was removed.";
  }, [`/admin/orders/${orderId}`]);
}

export async function markDeliveredAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await prisma.$transaction(async (tx) => {
      await transition(tx, orderId, "delivered", { actor: `admin:${u.email}`, message: "Marked delivered by admin." });
      await tx.shipment.updateMany({ where: { orderId, deliveredAt: null }, data: { deliveredAt: new Date(), status: "delivered" } });
    });
    await audit(u.email, "mark_delivered", "order", orderId);
    return "Marked delivered.";
  }, [`/admin/orders/${orderId}`]);
}

export async function addNoteAction(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const note = String(form.get("note") ?? "").trim();
    if (!note) throw new Error("Write a note first.");
    await noteEvent(orderId, "note", `admin:${u.email}`, note.slice(0, 2000));
    return "Note added.";
  }, [`/admin/orders/${orderId}`]);
}

export async function clearAttentionAction(orderId: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await prisma.order.update({ where: { id: orderId }, data: { attentionReason: null } });
    await audit(u.email, "clear_attention", "order", orderId);
    return "Cleared.";
  }, [`/admin/orders/${orderId}`, "/admin"]);
}

// ── Catalogue ──────────────────────────────────────────────────────────────

export async function updateVariantAction(id: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const price = Math.round(Number(form.get("price")) * 100);
    if (!Number.isInteger(price) || price < 100) throw new Error("Enter a valid price.");
    const data = {
      priceCents: price,
      fulfillmentSku: String(form.get("sku") ?? "").trim(),
      active: form.get("active") === "on",
      leadTimeMinDays: Number(form.get("leadMin")) || 5,
      leadTimeMaxDays: Number(form.get("leadMax")) || 9,
      bleedIn: Math.max(0, Math.min(0.5, Number(form.get("bleed")) || 0)),
    };
    if (!data.fulfillmentSku) throw new Error("A provider SKU is required.");
    await prisma.productVariant.update({ where: { id }, data });
    await audit(u.email, "update_variant", "variant", id, data as unknown as Prisma.InputJsonValue);
    return "Saved.";
  }, ["/admin/products"]);
}

export async function toggleTemplateAction(id: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const t = await prisma.designTemplate.findUniqueOrThrow({ where: { id } });
    await prisma.designTemplate.update({ where: { id }, data: { active: !t.active } });
    await audit(u.email, t.active ? "disable_template" : "enable_template", "template", id);
    return t.active ? "Hidden from the studio." : "Available in the studio.";
  }, ["/admin/templates"]);
}

export async function saveDiscountAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const code = normaliseCode(String(form.get("code") ?? ""));
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Codes are 3–40 letters, numbers, - or _.");
    const type = String(form.get("type")) as "percent" | "fixed" | "free_shipping";
    const raw = Number(form.get("value") || 0);
    const value = type === "fixed" ? Math.round(raw * 100) : Math.round(raw);
    if (type === "percent" && (value < 1 || value > 100)) throw new Error("Percent must be 1–100.");
    if (type === "fixed" && value < 1) throw new Error("Enter an amount.");
    const d = (k: string) => (form.get(k) ? new Date(String(form.get(k))) : null);
    const n = (k: string) => (form.get(k) ? Math.max(0, Number(form.get(k))) : null);
    const data = {
      code,
      type,
      value,
      description: String(form.get("description") ?? "").slice(0, 200) || null,
      minSubtotalCents: Math.round(Number(form.get("minSubtotal") || 0) * 100),
      startsAt: d("startsAt"),
      endsAt: d("endsAt"),
      maxRedemptions: n("maxRedemptions"),
      maxPerCustomer: n("maxPerCustomer"),
      variantIds: form.getAll("variantIds").map(String).filter(Boolean),
      active: form.get("active") === "on",
    };
    await prisma.discount.upsert({ where: { code }, create: data, update: data });
    await audit(u.email, "save_discount", "discount", code, data as unknown as Prisma.InputJsonValue);
    return `Saved ${code}.`;
  }, ["/admin/discounts"]);
}

export async function toggleDiscountAction(id: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const d = await prisma.discount.findUniqueOrThrow({ where: { id } });
    await prisma.discount.update({ where: { id }, data: { active: !d.active } });
    await audit(u.email, "toggle_discount", "discount", d.code, { active: !d.active });
    return d.active ? "Deactivated." : "Activated.";
  }, ["/admin/discounts"]);
}

// ── Operations ─────────────────────────────────────────────────────────────

export async function retryWebhookAction(id: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await enqueue(prisma, "process_webhook", { webhookEventId: id }, { dedupeKey: `process_webhook:${id}` });
    await audit(u.email, "retry_webhook", "webhook", id);
    return "Reprocessing queued.";
  }, ["/admin/system"]);
}

export async function retryJobAction(id: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await prisma.job.update({ where: { id }, data: { status: "queued", runAt: new Date(), attempts: 0, lastError: null, finishedAt: null } });
    await audit(u.email, "retry_job", "job", id);
    return "Job re-queued.";
  }, ["/admin/system"]);
}

export async function deleteUploadAction(id: string): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    const paid = await prisma.orderItem.count({ where: { audioAssetId: id, recordingRemovedAt: null, order: { paidAt: { not: null } } } });
    if (paid) throw new Error("This recording belongs to a paid order — use 'Remove recording' on the order instead.");
    await deleteAssetBytes(id, `admin:${u.email}`);
    await audit(u.email, "delete_upload", "asset", id);
    return "Deleted.";
  }, ["/admin/uploads"]);
}

export async function setContactStatusAction(id: string, status: "open" | "answered" | "closed"): Promise<ActionResult> {
  const u = await admin();
  return run(async () => {
    await prisma.contactMessage.update({ where: { id }, data: { status } });
    await audit(u.email, "contact_status", "contact", id, { status });
    return "Updated.";
  }, ["/admin/support"]);
}
