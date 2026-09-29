import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { cookieOptions, deviceKeyHash, SESSION_COOKIE } from "./identity";
import { getEnv } from "./env";

const SESSION_DAYS = 30;

/** The signed-in user for this request, or null. Never throws. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token || token.length < 20) return null;
    const session = await prisma.session.findUnique({ where: { tokenHash: sha256(`session:${token}`) }, include: { user: true } });
    if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
    // Sliding refresh at most once a day to avoid a write per request.
    if (Date.now() - session.lastSeenAt.getTime() > 24 * 3600 * 1000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } });
    }
    return session.user;
  } catch {
    return null;
  }
}

export function isAdminEmail(email: string): boolean {
  return getEnv().ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !isAdminEmail(user.email)) return null;
  return user;
}

/** Starts a fresh session (new random token — prevents session fixation). */
export async function startSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomToken(32);
  await prisma.session.create({
    data: { userId, tokenHash: sha256(`session:${token}`), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), userAgent: userAgent?.slice(0, 300) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS));
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(`session:${token}`) } });
  jar.delete(SESSION_COOKIE);
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
