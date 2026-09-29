import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { deliver } from "@/lib/server/email/send";
import { contactConfirmation, contactNotification } from "@/lib/server/email/templates";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { rateLimit } from "@/lib/server/rateLimit";
import { SUPPORT_EMAIL } from "@/lib/site";

const TOPICS = ["An order", "A recording or design question", "Remove my recording", "Wholesale / press", "Something else"] as const;

const Body = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
  topic: z.enum(TOPICS),
  orderNumber: z.string().trim().max(30).optional().nullable(),
  message: z.string().trim().min(5, "Please write a short message.").max(5000),
  website: z.string().max(0).optional(), // honeypot: bots fill every field
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("contact", clientIp(req));
  const b = await parseJson(req, Body);
  const m = await prisma.contactMessage.create({ data: { name: b.name, email: b.email, topic: b.topic, orderNumber: b.orderNumber?.toUpperCase() || null, message: b.message } });
  // Emails are best-effort: the message is already saved and visible in /admin/support.
  const notify = contactNotification(m);
  const confirm = contactConfirmation(m.name, m.topic);
  await Promise.allSettled([
    deliver({ dedupeKey: `contact_notify:${m.id}`, template: "contact_notification", to: SUPPORT_EMAIL, subject: notify.subject, html: notify.html, text: notify.text, replyTo: m.email }),
    deliver({ dedupeKey: `contact_confirm:${m.id}`, template: "contact_confirmation", to: m.email, subject: confirm.subject, html: confirm.html, text: confirm.text }),
  ]).then((r) => r.forEach((x) => x.status === "rejected" && log.warn("contact_email_failed", { err: x.reason })));
  return NextResponse.json({ ok: true });
});
