import { prisma } from "./db";
import { getEnv } from "./env";
import { log } from "./log";
import { recoverStuckJobs } from "./jobs/queue";
import { pruneRateLimits } from "./rateLimit";
import { runRetention } from "./retention";
import { markPaidFromSession } from "./orders/payment";
import { payments } from "./payments";
import { transition } from "./orders/state";

/**
 * Periodic housekeeping, run by the worker every 10 minutes:
 *  - payment reconciliation (catches a missed/delayed Stripe webhook),
 *  - expiry of unpaid checkouts, abandoned carts,
 *  - upload retention, rate-limit and session pruning, stuck-job recovery.
 */
export async function runMaintenance() {
  const env = getEnv();
  const out: Record<string, number> = {};
  out.stuckJobs = await recoverStuckJobs();

  // 1. Pending payments older than 45 min: ask Stripe what happened.
  const stale = await prisma.order.findMany({ where: { status: "pending_payment", createdAt: { lt: new Date(Date.now() - 45 * 60_000) } }, take: 50 });
  let reconciled = 0;
  for (const o of stale) {
    try {
      if (o.stripeCheckoutSessionId && payments().name === "stripe") {
        const s = await payments().retrieveCheckoutSession(o.stripeCheckoutSessionId);
        if (s?.payment_status === "paid") {
          await markPaidFromSession(s, "reconcile:stripe");
          reconciled++;
          continue;
        }
        if (s && s.status === "open") continue;
      }
      // Expired / never completed (or fake provider after 24 h).
      if (payments().name === "stripe" || Date.now() - o.createdAt.getTime() > 24 * 3600_000) {
        await prisma.$transaction((tx) => transition(tx, o.id, "cancelled", { actor: "reconcile", message: "Checkout was not completed.", extra: { cancelledAt: new Date() } }));
        if (o.cartId) await prisma.cart.updateMany({ where: { id: o.cartId, status: "checking_out" }, data: { status: "active" } });
      }
    } catch (err) {
      log.warn("reconcile_failed", { orderId: o.id, err });
    }
  }
  out.paymentsReconciled = reconciled;

  // 2. Carts idle for 30 days are marked abandoned (kept for optional, consented recovery emails).
  out.cartsAbandoned = (await prisma.cart.updateMany({ where: { status: { in: ["active", "checking_out"] }, lastActivityAt: { lt: new Date(Date.now() - 30 * 86400_000) } }, data: { status: "abandoned" } })).count;

  // 3. Upload retention.
  out.uploadsDeleted = (await runRetention({ apply: true })).length;

  // 4. Expired auth artefacts and old rate-limit windows.
  out.sessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  out.loginTokens = (await prisma.loginToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } } })).count;
  out.rateLimits = await pruneRateLimits();

  // 5. Webhooks that failed processing get another go.
  const failed = await prisma.webhookEvent.findMany({ where: { status: "failed", attempts: { lt: 10 } }, take: 20 });
  if (failed.length) {
    await import("./webhookHandlers");
    const { runStored } = await import("./webhooks");
    for (const w of failed) await runStored(w.id);
  }
  out.webhooksRetried = failed.length;

  if (Object.values(out).some((v) => v > 0)) log.info("maintenance", { ...out, env: env.NODE_ENV });
  return out;
}
