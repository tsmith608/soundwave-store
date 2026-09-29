import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { log } from "./log";

/** A user-facing error: `message` is safe to show; details stay in logs. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

/** Wraps a route handler: AppErrors become clean JSON; anything else is logged and hidden. */
export function route<C>(handler: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) return jsonError(err.status, err.code, err.message);
      log.error("route_failed", { path: req.nextUrl.pathname, method: req.method, err });
      return jsonError(500, "internal", "Something went wrong on our side. Please try again in a moment.");
    }
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 64_000): Promise<T> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new AppError(413, "too_large", "That request is too large.");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new AppError(413, "too_large", "That request is too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "bad_json", "We couldn't read that request.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(400, "invalid", first?.message && !first.message.startsWith("Invalid") ? first.message : "Some of the details look wrong. Please check and try again.");
  }
  return parsed.data;
}

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  // Trust the first hop added by the platform proxy (Fly/Railway/Render/Cloudflare all set these).
  return (h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
}

/**
 * Same-origin check for state-changing JSON endpoints called by our own pages
 * (defence-in-depth on top of SameSite=Lax cookies). Webhooks don't use this.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (tests, curl) have no Origin; cookies still SameSite
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AppError(403, "bad_origin", "This request came from another site.");
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(403, "bad_origin", "This request came from another site.");
  }
}

export { z };
