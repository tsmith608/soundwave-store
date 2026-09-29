import { cookies } from "next/headers";
import { randomToken, sha256 } from "./crypto";
import { getEnv } from "./env";

/**
 * Anonymous device identity. A random HttpOnly cookie lets a guest keep their
 * projects, uploads and cart without an account. Only its hash is stored, so a
 * database leak can't be replayed as a cookie.
 */
export const DEVICE_COOKIE = "sw_did";
export const CART_COOKIE = "sw_cart";
export const SESSION_COOKIE = "sw_session";

export function cookieOptions(maxAgeDays: number) {
  return {
    httpOnly: true,
    secure: getEnv().isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeDays * 24 * 3600,
  };
}

/** Returns the hashed device key, creating the cookie if needed (route handlers / server actions only). */
export async function deviceKeyHash(create = true): Promise<string | null> {
  const jar = await cookies();
  let v = jar.get(DEVICE_COOKIE)?.value;
  if (!v || v.length < 20) {
    if (!create) return null;
    v = randomToken(24);
    jar.set(DEVICE_COOKIE, v, cookieOptions(365));
  }
  return sha256(`device:${v}`);
}
