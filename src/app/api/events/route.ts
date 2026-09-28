import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED = new Set([
  "landing_view",
  "design_selected",
  "personalization_started",
  "audio_uploaded",
  "preview_generated",
  "add_to_cart",
  "checkout_initiated",
  "purchase",
]);

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
    const params = body.params && typeof body.params === "object" ? JSON.stringify(body.params).slice(0, 2000) : null;
    await prisma.analyticsEvent
      .create({
        data: {
          event: body.event,
          eventId: str(body.eventId, 80),
          sessionId: str(body.sessionId, 80),
          path: str(body.path, 300),
          referrer: str(body.referrer, 300),
          params,
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
