import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { clientIp } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

// "purchase" is intentionally absent: it is recorded server-side from the Stripe webhook.
const ALLOWED = new Set(["page_view", "product_view", "design_selected", "customizer_started", "media_uploaded", "design_generated", "customization_completed", "add_to_cart", "checkout_started"]);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

/**
 * First-party funnel log. Accepts beacons from src/lib/analytics.ts and
 * stores them so the funnel can be read straight from the database before
 * (or without) GA4. Always answers 204 so tracking never affects the page.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !ALLOWED.has(body.event)) return new NextResponse(null, { status: 204 });
    await rateLimit("events", clientIp(req));
    const raw = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : null;
    // Keep only flat, short primitive values — never free text from the customer.
    const params = raw ? Object.fromEntries(Object.entries(raw).filter(([k, v]) => k.length < 40 && ["string", "number", "boolean"].includes(typeof v)).slice(0, 20).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 120) : v])) : undefined;
    await prisma.analyticsEvent
      .create({
        data: {
          event: body.event,
          eventId: str(body.eventId, 80),
          sessionId: str(body.sessionId, 80),
          path: str(body.path, 300),
          referrer: str(body.referrer, 300),
          params: params as Prisma.InputJsonValue | undefined,
          userAgent: str(req.headers.get("user-agent"), 300),
        },
      })
      .catch((err: Error) => {
        if (process.env.NODE_ENV !== "production") console.info("[events]", body.event, "(not stored:", err.message.split("\n")[0], ")");
      });
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}
