import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { log } from "./log";

export type WebhookProvider = "stripe" | "prodigi" | "resend";
type Handler = (payload: unknown) => Promise<"processed" | "ignored">;

const handlers: Partial<Record<WebhookProvider, Handler>> = {};

/** Registers the processor for a provider so stored events can be re-run (admin retry). */
export function registerWebhookHandler(provider: WebhookProvider, h: Handler) {
  handlers[provider] = h;
}

/**
 * Stores every verified event once (unique on provider + event id), then
 * processes it. Duplicate deliveries of an already-processed event are
 * acknowledged without side effects. Failures are recorded and return 500 so
 * the provider retries; admins can also retry from /admin/system.
 */
export async function ingestWebhook(provider: WebhookProvider, eventId: string, type: string, payload: unknown, handler: Handler): Promise<{ status: number; body: Record<string, unknown> }> {
  const existing = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider, eventId } } });
  if (existing && (existing.status === "processed" || existing.status === "ignored")) {
    return { status: 200, body: { received: true, duplicate: true } };
  }
  const row =
    existing ??
    (await prisma.webhookEvent
      .create({ data: { provider, eventId, type, payload: payload as Prisma.InputJsonValue } })
      .catch(async () => prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider, eventId } } })));
  return runStored(row.id, handler);
}

export async function runStored(webhookEventId: string, handler?: Handler): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: webhookEventId } });
  const h = handler ?? handlers[row.provider as WebhookProvider];
  if (!h) return { status: 500, body: { error: "No handler registered" } };
  try {
    const outcome = await h(row.payload);
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { status: outcome, processedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
    return { status: 200, body: { received: true, status: outcome } };
  } catch (err) {
    log.error("webhook_processing_failed", { provider: row.provider, eventId: row.eventId, type: row.type, err });
    await prisma.webhookEvent.update({ where: { id: row.id }, data: { status: "failed", attempts: { increment: 1 }, lastError: (err as Error).message?.slice(0, 2000) } });
    return { status: 500, body: { error: "Processing failed; will retry" } };
  }
}
