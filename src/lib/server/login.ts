import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { getEnv } from "./env";
import { log } from "./log";
import { deliver } from "./email/send";
import { loginLink } from "./email/templates";
import { isAdminEmail, startSession } from "./auth";

const TTL_MS = 20 * 60_000;

export function safeNext(next: string | null | undefined): string {
  // Only same-site relative paths: blocks open redirects like //evil.com or https://…
  return next && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : "/account";
}

/** Emails a single-use sign-in link. Always "succeeds" so it can't reveal which emails have accounts. */
export async function requestLogin(email: string, next: string, ip: string) {
  const recent = await prisma.loginToken.count({ where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
  if (recent >= 3) return; // per-email throttle (per-IP throttle is in the route)
  const token = randomToken(32);
  await prisma.loginToken.create({ data: { email, tokenHash: sha256(`login:${token}`), expiresAt: new Date(Date.now() + TTL_MS), ip } });
  const url = `${getEnv().NEXT_PUBLIC_APP_URL}/account/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext(next))}`;
  const r = loginLink(url);
  try {
    await deliver({ dedupeKey: `login:${sha256(token).slice(0, 24)}`, template: "login_link", to: email, subject: r.subject, html: r.html, text: r.text });
  } catch (err) {
    log.error("login_email_failed", { err });
  }
}

/** Consumes a sign-in token, verifies the email, links guest history and starts a session. */
export async function completeLogin(token: string, userAgent: string | null, deviceKeyHash: string | null) {
  const row = await prisma.loginToken.findUnique({ where: { tokenHash: sha256(`login:${token}`) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  const used = await prisma.loginToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return null; // raced — single use
  const email = row.email;
  const admin = isAdminEmail(email);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, emailVerifiedAt: new Date(), role: admin ? "admin" : "customer" },
    update: { emailVerifiedAt: new Date(), role: admin ? "admin" : "customer", deletedAt: null },
  });
  // The email is now verified, so guest orders placed with it are safely theirs.
  await prisma.order.updateMany({ where: { userId: null, email, paidAt: { not: null } }, data: { userId: user.id } });
  if (deviceKeyHash) {
    await prisma.project.updateMany({ where: { ownerKeyHash: deviceKeyHash, userId: null }, data: { userId: user.id } });
    await prisma.uploadedAsset.updateMany({ where: { ownerKeyHash: deviceKeyHash, userId: null }, data: { userId: user.id } });
  }
  await startSession(user.id, userAgent);
  log.info("login", { userId: user.id, admin });
  return user;
}
