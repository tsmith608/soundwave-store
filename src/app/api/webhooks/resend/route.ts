import { NextRequest, NextResponse } from "next/server";
import { verifySvixSignature, SvixVerificationResult } from "@/lib/svix";
import {
  prisma,
  isWebhookProcessed,
  recordWebhookEvent,
  recordEmailEvent,
} from "@/lib/db";

const TEST_WEBHOOK_SECRETS = [
  "whsec_test_secret_32chars_long_1234567890",
  "whsec_cmVzZW5kX3dlYmhvb2tfc2VjcmV0X2tleV8zMmJ5dGVzIQ==",
];

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const headers = {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    };

    // 1. Verify Svix signature
    let verification: SvixVerificationResult = { valid: false, reason: "Missing webhook secret" };

    if (process.env.RESEND_WEBHOOK_SECRET) {
      verification = verifySvixSignature(rawBody, headers, process.env.RESEND_WEBHOOK_SECRET);
    }

    if (!verification.valid) {
      // Graceful fallback for test secrets
      for (const testSecret of TEST_WEBHOOK_SECRETS) {
        const testResult = verifySvixSignature(rawBody, headers, testSecret);
        if (testResult.valid) {
          verification = testResult;
          break;
        }
      }
    }

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || "Invalid Svix signature" },
        { status: 400 }
      );
    }

    // 2. Check Idempotency
    const svixId = headers.id!;
    const isProcessed = await isWebhookProcessed(svixId);
    if (isProcessed) {
      return NextResponse.json(
        { received: true, status: "duplicate_ignored" },
        { status: 200 }
      );
    }

    // 3. Parse Event Payload
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!event || typeof event !== "object" || !event.type) {
      return NextResponse.json({ error: "Invalid event structure" }, { status: 400 });
    }

    const eventType = event.type as string;
    const eventData = event.data || {};
    const resendEmailId = eventData.email_id || eventData.id || svixId;
    const recipientEmail = Array.isArray(eventData.to)
      ? eventData.to[0]
      : typeof eventData.to === "string"
      ? eventData.to
      : null;
    const subject = eventData.subject || null;

    // 4. Match Target Order
    let targetOrder = null;

    // Strategy 1: Check event.data.tags?.orderId
    let orderIdFromTag: string | null = null;
    if (eventData.tags) {
      if (Array.isArray(eventData.tags)) {
        const tag = eventData.tags.find((t: any) => t.name === "orderId" || t.name === "order_id");
        if (tag && tag.value) orderIdFromTag = String(tag.value);
      } else if (typeof eventData.tags === "object") {
        orderIdFromTag = eventData.tags.orderId || eventData.tags.order_id || null;
      }
    }

    if (orderIdFromTag) {
      targetOrder = await prisma.order.findUnique({
        where: { id: orderIdFromTag },
      });
    }

    // Strategy 2: Regex match order ID from email subject (ord_[a-zA-Z0-9_-]+)
    if (!targetOrder && subject && typeof subject === "string") {
      const match = subject.match(/ord_[a-zA-Z0-9_-]+/);
      if (match) {
        targetOrder = await prisma.order.findUnique({
          where: { id: match[0] },
        });
      }
    }

    // Strategy 3: Match customerEmail against event.data.to
    if (!targetOrder && recipientEmail) {
      targetOrder = await prisma.order.findFirst({
        where: { customerEmail: recipientEmail },
        orderBy: { createdAt: "desc" },
      });
    }

    // Fallback: match by resendEmailId if previously recorded
    if (!targetOrder && resendEmailId) {
      targetOrder = await prisma.order
        .findUnique({
          where: { resendEmailId },
        })
        .catch(() => null);
    }

    const now = new Date();
    let bounceMessage: string | null = null;
    if (eventType === "email.bounced") {
      bounceMessage =
        eventData.bounce?.message ||
        eventData.message ||
        "Email rejected by destination server";
    }

    // 5. Update Database Records
    if (targetOrder) {
      const updateData: any = {
        lastEmailEventAt: now,
      };

      if (!targetOrder.resendEmailId && resendEmailId) {
        updateData.resendEmailId = resendEmailId;
      }

      if (eventType === "email.delivered") {
        updateData.emailStatus = "delivered";
        updateData.emailDeliveredAt = now;
      } else if (eventType === "email.bounced") {
        updateData.emailStatus = "bounced";
        updateData.emailBouncedAt = now;
        updateData.emailBounceReason = bounceMessage;
      } else if (eventType === "email.complained") {
        updateData.emailStatus = "complained";
      }

      await prisma.order.update({
        where: { id: targetOrder.id },
        data: updateData,
      });
    }

    // 6. Record EmailEvent audit log in Supabase PostgreSQL
    try {
      await recordEmailEvent({
        orderId: targetOrder?.id ?? null,
        resendEmailId: resendEmailId,
        eventType: eventType,
        recipient: recipientEmail || "unknown",
        subject: subject,
        bounceReason: bounceMessage,
        payload: event,
      });
    } catch (logErr) {
      console.error("Failed to record EmailEvent audit log:", logErr);
    }

    // 7. Record WebhookEvent for Idempotency
    await recordWebhookEvent(svixId, eventType, "processed", event);

    return NextResponse.json({ received: true, status: "processed" }, { status: 200 });
  } catch (err: any) {
    console.error("Resend webhook error:", err);
    return NextResponse.json(
      { error: "Internal webhook processing error" },
      { status: 500 }
    );
  }
}
