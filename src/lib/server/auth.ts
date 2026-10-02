import { cookies, headers } from "next/headers";
import type { Session, User } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { cookieOptions, deviceKeyHash, sessionCookieName } from "./identity";
import { clientIp } from "./http";
import { log } from "./log";
import { getEnv } from "./env";

const SESSION_DAYS = 30;

/** The signed-in session (with its user) for this request, or null. Never throws. */
async function getCurrentSession(): Promise<(Session & { user: User }) | null> {
  try {
    const token = (await cookies()).get(sessionCookieName())?.value;
    if (!token || token.length < 20) return null;
    const session = await prisma.session.findUnique({ where: { tokenHash: sha256(`session:${token}`) }, include: { user: true } });
    if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
    // Sliding refresh at most once a day to avoid a write per request.
    if (Date.now() - session.lastSeenAt.getTime() > 24 * 3600 * 1000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } });
    }
    return session;
  } catch {
    return null;
  }
}

/** The signed-in user for this request, or null. Never throws. */
export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

export function isAdminEmail(email: string): boolean {
  return getEnv().ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * The admin for this request, or null. On top of a valid session this requires:
 *  - the email to still be listed in ADMIN_EMAILS (removing it revokes access at once);
 *  - a session younger than ADMIN_SESSION_HOURS (default 12): admins sign in again
 *    each day even though customer sessions last 30 days;
 *  - if ADMIN_IP_ALLOWLIST is set, a request from one of those IPs.
 */
export async function requireAdmin(): Promise<User | null> {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!session || !user || user.role !== "admin" || !isAdminEmail(user.email)) return null;
  const env = getEnv();
  if (Date.now() - session.createdAt.getTime() > env.ADMIN_SESSION_HOURS * 3600 * 1000) return null;
  if (env.ADMIN_IP_ALLOWLIST.length) {
    const ip = clientIp(await headers());
    if (!env.ADMIN_IP_ALLOWLIST.includes(ip)) {
      log.warn("admin_ip_blocked", { userId: user.id, ip });
      return null;
    }
  }
  return user;
}

/** Starts a fresh session (new random token — prevents session fixation). */
export async function startSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomToken(32);
  await prisma.session.create({
    data: { userId, tokenHash: sha256(`session:${token}`), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), userAgent: userAgent?.slice(0, 300) ?? null },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(), token, cookieOptions(SESSION_DAYS));
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(`session:${token}`) } });
  jar.delete(sessionCookieName());
}

export interface Owner {
  userId: string | null;
  deviceKeyHash: string | null;
}

/** Who is making this request: a signed-in user and/or an anonymous device. */
export async function getOwner(createDevice = true): Promise<Owner> {
  const [user, dk] = await Promise.all([getCurrentUser(), deviceKeyHash(createDevice)]);
  return { userId: user?.id ?? null, deviceKeyHash: dk };
}

export function ownsRecord(owner: Owner, rec: { userId?: string | null; ownerKeyHash?: string | null }): boolean {
  if (rec.userId && owner.userId && rec.userId === owner.userId) return true;
  if (rec.ownerKeyHash && owner.deviceKeyHash && rec.ownerKeyHash === owner.deviceKeyHash) return true;
  return false;
}
