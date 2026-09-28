import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Ensure environment variables are loaded in non-Next.js environments (e.g. tsx runner)
if (!process.env.DATABASE_URL) {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            if (key === "DATABASE_URL" || key === "DIRECT_URL") {
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
      } catch {
        // Non-fatal fallback
      }
    }
  }
}

// Global singleton pattern for PrismaClient in Next.js
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const ORDER_STATUSES = [
  "pending_payment",
  "pending_fulfillment",
  "fulfillment_submitted",
  "shipped",
  "delivered",
  "payment_failed",
  "cancelled",
  "fulfillment_failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  pending_fulfillment: "Payment Confirmed",
  fulfillment_submitted: "Print Submitted",
  shipped: "Shipped",
  delivered: "Delivered",
  payment_failed: "Payment Failed",
  cancelled: "Cancelled",
  fulfillment_failed: "Fulfillment Failed",
};

/**
 * Configures SQLite PRAGMAs for concurrency and performance:
 * - WAL mode (Write-Ahead Logging): Allows simultaneous readers and writers
 * - synchronous = NORMAL: Safe fsync policy for WAL mode, reduces I/O wait
 * - busy_timeout = 5000: Retries for up to 5s if lock contention occurs
 *
 * NOTE: Bypassed when connected to PostgreSQL (Supabase) to avoid syntax errors and connection aborts.
 */
let pragmaPromise: Promise<void> | null = null;
export async function ensurePragmas(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgres:") || dbUrl.startsWith("postgresql:");
  if (isPostgres) {
    return;
  }

  const isSqlite = dbUrl.startsWith("file:") || dbUrl.startsWith("sqlite:") || dbUrl.includes(".db");
  if (!isSqlite && dbUrl.length > 0) {
    return;
  }

  if (!pragmaPromise) {
    pragmaPromise = (async () => {
      try {
        await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
        await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL;");
        await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
      } catch {
        // Non-fatal if DB not yet initialized or in read-only environment
      }
    })();
  }
  return pragmaPromise;
}

// Auto-trigger on module initialization (no-op on PostgreSQL)
void ensurePragmas();

/**
 * Sanitizes input strings to ensure well-formed UTF-16 / UTF-8.
 * Replaces lone / unpaired Unicode surrogates (e.g. \uD83C) with \uFFFD,
 * preventing Prisma/Rust query engine deserialization crashes.
 */
export function sanitizeString<T extends string | null | undefined>(val: T): T {
  if (typeof val === "string") {
    return (typeof val.toWellFormed === "function" ? val.toWellFormed() : val) as T;
  }
  return val;
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface CreateOrderInput {
  id?: string;
  customerEmail: string;
  shippingName?: string | null;
  shippingAddress?: string | null;
  frameSize: string;
  palette: string;
  caption?: string | null;
  audioPath: string;
  photoPath?: string | null;
  decorativeTheme?: string | null;
  previewUrl?: string | null;
  printPdfPath?: string | null;
  status?: OrderStatus;
  partnerOrderId?: string | null;
  stripeSessionId?: string | null;
  totalAmount: number;

  // Milestone 3: Etsy Integration Fields
  source?: string;
  externalOrderId?: string | null;
  personalizationData?: string | null;
  etsyListingId?: string | null;
  etsyReceiptId?: string | null;
  audioSourceUrl?: string | null;

  // Milestone 4: Resend Email Tracking Fields
  resendEmailId?: string | null;
  emailStatus?: string | null;
  emailDeliveredAt?: Date | null;
  emailBounceReason?: string | null;
  emailBouncedAt?: Date | null;
  lastEmailEventAt?: Date | null;
}

export async function createOrder(data: CreateOrderInput) {
  await ensurePragmas();
  return await prisma.order.create({
    data: {
      ...(data.id ? { id: sanitizeString(data.id) } : {}),
      customerEmail: sanitizeString(data.customerEmail),
      shippingName: sanitizeString(data.shippingName) ?? null,
      shippingAddress: sanitizeString(data.shippingAddress) ?? null,
      frameSize: sanitizeString(data.frameSize),
      palette: sanitizeString(data.palette),
      caption: sanitizeString(data.caption) ?? null,
      audioPath: sanitizeString(data.audioPath),
      photoPath: sanitizeString(data.photoPath) ?? null,
      decorativeTheme: sanitizeString(data.decorativeTheme) || "botanical",
      previewUrl: sanitizeString(data.previewUrl) ?? null,
      printPdfPath: sanitizeString(data.printPdfPath) ?? null,
      status: sanitizeString(data.status) || "pending_payment",
      partnerOrderId: sanitizeString(data.partnerOrderId) ?? null,
      stripeSessionId: sanitizeString(data.stripeSessionId) ?? null,
      totalAmount: data.totalAmount,

      // Etsy fields
      source: sanitizeString(data.source) || "direct",
      externalOrderId: sanitizeString(data.externalOrderId) ?? null,
      personalizationData: sanitizeString(data.personalizationData) ?? null,
      etsyListingId: sanitizeString(data.etsyListingId) ?? null,
      etsyReceiptId: sanitizeString(data.etsyReceiptId) ?? null,
      audioSourceUrl: sanitizeString(data.audioSourceUrl) ?? null,

      // Resend fields
      resendEmailId: sanitizeString(data.resendEmailId) ?? null,
      emailStatus: sanitizeString(data.emailStatus) || "not_sent",
      emailDeliveredAt: data.emailDeliveredAt ?? null,
      emailBounceReason: sanitizeString(data.emailBounceReason) ?? null,
      emailBouncedAt: data.emailBouncedAt ?? null,
      lastEmailEventAt: data.lastEmailEventAt ?? null,
    },
  });
}

export async function getOrderById(id: string) {
  await ensurePragmas();
  return await prisma.order.findUnique({
    where: { id: sanitizeString(id) },
    include: {
      fulfillmentLogs: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function getOrderByStripeSessionId(stripeSessionId: string) {
  await ensurePragmas();
  return await prisma.order.findUnique({
    where: { stripeSessionId: sanitizeString(stripeSessionId) },
    include: {
      fulfillmentLogs: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  updates?: {
    partnerOrderId?: string | null;
    printPdfPath?: string | null;
    previewUrl?: string | null;
    photoPath?: string | null;
    shippingName?: string | null;
    shippingAddress?: string | null;
    customerEmail?: string;
    externalOrderId?: string | null;
    resendEmailId?: string | null;
    emailStatus?: string | null;
  }
) {
  await ensurePragmas();
  return await prisma.order.update({
    where: { id: sanitizeString(id) },
    data: {
      status: sanitizeString(status),
      ...(updates?.partnerOrderId !== undefined ? { partnerOrderId: sanitizeString(updates.partnerOrderId) } : {}),
      ...(updates?.printPdfPath !== undefined ? { printPdfPath: sanitizeString(updates.printPdfPath) } : {}),
      ...(updates?.previewUrl !== undefined ? { previewUrl: sanitizeString(updates.previewUrl) } : {}),
      ...(updates?.photoPath !== undefined ? { photoPath: sanitizeString(updates.photoPath) } : {}),
      ...(updates?.shippingName !== undefined ? { shippingName: sanitizeString(updates.shippingName) } : {}),
      ...(updates?.shippingAddress !== undefined ? { shippingAddress: sanitizeString(updates.shippingAddress) } : {}),
      ...(updates?.customerEmail !== undefined ? { customerEmail: sanitizeString(updates.customerEmail) } : {}),
      ...(updates?.externalOrderId !== undefined ? { externalOrderId: sanitizeString(updates.externalOrderId) } : {}),
      ...(updates?.resendEmailId !== undefined ? { resendEmailId: sanitizeString(updates.resendEmailId) } : {}),
      ...(updates?.emailStatus !== undefined ? { emailStatus: sanitizeString(updates.emailStatus) } : {}),
    },
  });
}

export async function addFulfillmentLog(
  orderId: string,
  step: string,
  status: string,
  details?: string | null
) {
  await ensurePragmas();
  return await prisma.fulfillmentLog.create({
    data: {
      orderId: sanitizeString(orderId),
      step: sanitizeString(step),
      status: sanitizeString(status),
      details: sanitizeString(details) ?? null,
    },
  });
}

export async function getFulfillmentLogs(orderId: string) {
  await ensurePragmas();
  return await prisma.fulfillmentLog.findMany({
    where: { orderId: sanitizeString(orderId) },
    orderBy: { timestamp: "asc" },
  });
}

export async function recordWebhookEvent(
  eventId: string,
  eventType: string,
  status: string,
  payload: string | object,
  processedAt?: Date | null
) {
  await ensurePragmas();
  const payloadStr =
    typeof payload === "string"
      ? sanitizeString(payload)
      : sanitizeString(JSON.stringify(payload));
  return await prisma.webhookEvent.upsert({
    where: { eventId: sanitizeString(eventId) },
    create: {
      eventId: sanitizeString(eventId),
      eventType: sanitizeString(eventType),
      status: sanitizeString(status),
      payload: payloadStr,
      processedAt: processedAt ?? (status === "processed" ? new Date() : null),
    },
    update: {
      status: sanitizeString(status),
      payload: payloadStr,
      processedAt: processedAt ?? (status === "processed" ? new Date() : null),
    },
  });
}

export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  await ensurePragmas();
  const event = await prisma.webhookEvent.findUnique({
    where: { eventId: sanitizeString(eventId) },
  });
  return event?.status === "processed";
}

// ============================================================================
// Milestone 3: Etsy Integration Helpers
// ============================================================================

export async function saveEtsyToken(data: {
  shopId?: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType?: string | null;
  scope?: string | null;
}) {
  await ensurePragmas();
  const existing = data.shopId
    ? await prisma.etsyToken.findFirst({ where: { shopId: sanitizeString(data.shopId) } })
    : await prisma.etsyToken.findFirst({ orderBy: { createdAt: "desc" } });

  if (existing) {
    return await prisma.etsyToken.update({
      where: { id: existing.id },
      data: {
        accessToken: sanitizeString(data.accessToken),
        refreshToken: sanitizeString(data.refreshToken),
        expiresAt: data.expiresAt,
        tokenType: sanitizeString(data.tokenType) ?? "Bearer",
        scope: sanitizeString(data.scope) ?? null,
        ...(data.shopId ? { shopId: sanitizeString(data.shopId) } : {}),
      },
    });
  }

  return await prisma.etsyToken.create({
    data: {
      shopId: sanitizeString(data.shopId) ?? null,
      accessToken: sanitizeString(data.accessToken),
      refreshToken: sanitizeString(data.refreshToken),
      expiresAt: data.expiresAt,
      tokenType: sanitizeString(data.tokenType) ?? "Bearer",
      scope: sanitizeString(data.scope) ?? null,
    },
  });
}

export async function getEtsyToken(shopId?: string) {
  await ensurePragmas();
  if (shopId) {
    return await prisma.etsyToken.findFirst({
      where: { shopId: sanitizeString(shopId) },
      orderBy: { createdAt: "desc" },
    });
  }
  return await prisma.etsyToken.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderByPartnerOrderId(partnerOrderId: string) {
  await ensurePragmas();
  return await prisma.order.findFirst({
    where: {
      OR: [
        { partnerOrderId: sanitizeString(partnerOrderId) },
        { externalOrderId: sanitizeString(partnerOrderId) },
      ],
    },
  });
}

// ============================================================================
// Milestone 4: Resend Email Tracking Helpers
// ============================================================================

export async function updateOrderEmailStatus(
  identifier: { orderId?: string; resendEmailId?: string } | string,
  emailStatus: string,
  options?: {
    bounceReason?: string | null;
    deliveredAt?: Date | null;
    bouncedAt?: Date | null;
  }
) {
  await ensurePragmas();
  let where: { id: string } | { resendEmailId: string };

  if (typeof identifier === "string") {
    where = identifier.startsWith("re_")
      ? { resendEmailId: sanitizeString(identifier) }
      : { id: sanitizeString(identifier) };
  } else if (identifier.resendEmailId) {
    where = { resendEmailId: sanitizeString(identifier.resendEmailId) };
  } else if (identifier.orderId) {
    where = { id: sanitizeString(identifier.orderId) };
  } else {
    return null;
  }

  const now = new Date();
  const data: any = {
    emailStatus: sanitizeString(emailStatus),
    lastEmailEventAt: now,
  };

  if (emailStatus === "delivered" || options?.deliveredAt) {
    data.emailDeliveredAt = options?.deliveredAt ?? now;
  }
  if (emailStatus === "bounced" || options?.bouncedAt || options?.bounceReason) {
    data.emailBouncedAt = options?.bouncedAt ?? now;
    data.emailBounceReason = sanitizeString(options?.bounceReason) ?? null;
  }

  try {
    return await prisma.order.update({
      where: where as any,
      data,
    });
  } catch {
    if (typeof identifier === "string" && !identifier.startsWith("re_")) {
      return await prisma.order
        .update({
          where: { resendEmailId: sanitizeString(identifier) },
          data,
        })
        .catch(() => null);
    }
    return null;
  }
}

export interface RecordEmailEventInput {
  orderId?: string | null;
  resendEmailId: string;
  eventType: string;
  recipient: string;
  subject?: string | null;
  bounceReason?: string | null;
  payload?: string | object | null;
}

export async function recordEmailEvent(data: RecordEmailEventInput) {
  await ensurePragmas();
  const payloadStr =
    data.payload === null || data.payload === undefined
      ? null
      : typeof data.payload === "string"
      ? sanitizeString(data.payload)
      : sanitizeString(JSON.stringify(data.payload));

  return await prisma.emailEvent.create({
    data: {
      orderId: data.orderId ? sanitizeString(data.orderId) : null,
      resendEmailId: sanitizeString(data.resendEmailId),
      eventType: sanitizeString(data.eventType),
      recipient: sanitizeString(data.recipient),
      subject: sanitizeString(data.subject) ?? null,
      bounceReason: sanitizeString(data.bounceReason) ?? null,
      payload: payloadStr,
    },
  });
}

export async function getEmailEvents(orderId: string) {
  await ensurePragmas();
  return await prisma.emailEvent.findMany({
    where: { orderId: sanitizeString(orderId) },
    orderBy: { createdAt: "desc" },
  });
}
