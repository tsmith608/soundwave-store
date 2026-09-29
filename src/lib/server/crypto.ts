import crypto from "crypto";
import { getEnv } from "./env";

/** URL-safe random token with `bytes` of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmac(input: string, purpose: string): string {
  return crypto.createHmac("sha256", `${getEnv().appSecret}:${purpose}`).update(input).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Signed, expiring token for a single purpose: `<payload>.<exp>.<sig>`. */
export function signToken(payload: string, purpose: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${payload}.${exp}`;
  return `${body}.${hmac(body, purpose)}`;
}

export function verifyToken(token: string, purpose: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEqual(sig, hmac(body, purpose))) return null;
  const j = body.lastIndexOf(".");
  const exp = Number(body.slice(j + 1));
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  return body.slice(0, j);
}
