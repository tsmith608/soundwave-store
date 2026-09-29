import fs from "fs/promises";
import path from "path";
import { prisma } from "../db";
import { getEnv } from "../env";
import { log } from "../log";

export interface OutgoingEmail {
  dedupeKey: string;
  template: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  orderId?: string | null;
  replyTo?: string;
}

/**
 * Sends once per dedupeKey. Resend's Idempotency-Key header is set to the
 * same key, so even a crash between "sent" and "recorded" can't double-send.
 */
export async function deliver(msg: OutgoingEmail): Promise<"sent" | "duplicate"> {
  const env = getEnv();
  const existing = await prisma.emailMessage.findUnique({ where: { dedupeKey: msg.dedupeKey } });
  if (existing && existing.status !== "queued" && existing.status !== "failed") return "duplicate";
  const row =
    existing ??
    (await prisma.emailMessage.create({ data: { dedupeKey: msg.dedupeKey, template: msg.template, to: msg.to, subject: msg.subject, provider: env.emailProvider, orderId: msg.orderId ?? null } }));

  try {
    let providerMessageId: string;
    if (env.emailProvider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": msg.dedupeKey.slice(0, 256) },
        body: JSON.stringify({ from: env.emailFrom, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: msg.replyTo ?? env.EMAIL_REPLY_TO ?? undefined, tags: [{ name: "template", value: msg.template }] }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !json.id) throw new Error(`Resend ${res.status}: ${json.message ?? "no id"}`);
      providerMessageId = json.id;
    } else {
      // Development: write to storage/emails so messages can be opened in a browser.
      const dir = path.resolve(process.cwd(), "storage", "emails");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${msg.template}.html`);
      await fs.writeFile(file, `<!-- to: ${msg.to} | subject: ${msg.subject} -->\n${msg.html}`);
      providerMessageId = `file:${path.basename(file)}`;
    }
    await prisma.emailMessage.update({ where: { id: row.id }, data: { status: "sent", providerMessageId, sentAt: new Date(), error: null } });
    log.info("email_sent", { template: msg.template, emailId: row.id, orderId: msg.orderId });
    return "sent";
  } catch (err) {
    await prisma.emailMessage.update({ where: { id: row.id }, data: { status: "failed", error: (err as Error).message.slice(0, 1000) } });
    throw err;
  }
}
