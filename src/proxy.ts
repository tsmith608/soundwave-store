import { NextResponse, type NextRequest } from "next/server";
import { storageOrigin } from "@/lib/server/storage/origin";

/**
 * Security headers for every page and API response. Computed at runtime so
 * the CSP can allow the configured storage bucket for direct uploads.
 *
 * script-src keeps 'unsafe-inline' because Next.js streams inline RSC
 * payload scripts and pages are statically rendered (nonces would force every
 * page to be dynamic). React escapes all user content, no user HTML is ever
 * rendered, and everything else is locked down.
 */
const isProd = process.env.NODE_ENV === "production";
const storage = storageOrigin();
const sentry = "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io";
const analytics = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://connect.facebook.net https://www.facebook.com https://analytics.tiktok.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${analytics}`,
  "font-src 'self' data:",
  `connect-src 'self' ${analytics} ${sentry}${storage ? ` ${storage}` : ""}`,
  `media-src 'self' blob:${storage ? ` ${storage}` : ""}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const h = res.headers;
  h.set("Content-Security-Policy", csp);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(self), payment=(), usb=(), interest-cohort=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  if (isProd) h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  const p = req.nextUrl.pathname;
  if (p.startsWith("/admin") || p.startsWith("/account") || p.startsWith("/order") || p.startsWith("/l/") || p.startsWith("/checkout")) {
    h.set("X-Robots-Tag", "noindex, nofollow");
    h.set("Cache-Control", "private, no-store");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|mockups/|fonts/).*)"],
};
