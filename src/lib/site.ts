/**
 * Site identity from environment. Do not hard-code a domain: "soundwaveart.com"
 * belongs to an unrelated company (see docs/owner-review.md → brand decision).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "SoundWave Art";
