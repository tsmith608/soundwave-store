/**
 * Upload retention policy (owner decision, 28 Sep 2026). Pure — tested in
 * tests/unit/retention.test.ts; applied by the worker's clean-up task.
 *
 * - A recording behind a printed QR code is kept for as long as the business
 *   runs — the code must keep playing it.
 * - A recording on an order without a QR code is deleted 90 days after
 *   delivery (or 90 days after an assumed 21-day transit if no delivery scan).
 * - Recordings only used by cancelled / failed / unpaid orders: 30 days.
 * - Uploads never ordered (drafts, abandoned studio sessions): 30 days after
 *   upload; upload intents whose bytes never arrived: 24 hours.
 * - Anyone can ask for a recording to be removed at any time
 *   (scripts/remove-recording.ts) — that overrides everything above.
 */
export const RETENTION_DAYS = { delivered: 90, assumedTransit: 21, closed: 30, unattached: 30 } as const;
const DAY = 86_400_000;

export type OrderUse = {
  orderStatus: string;
  hasQr: boolean;
  recordingRemoved: boolean;
  deliveredAt: Date | null;
  shippedAt: Date | null;
  closedAt: Date | null; // cancelled / failed / last update of an unpaid order
};

export type AssetInput = {
  status: "pending" | "ready" | "rejected" | "deleted";
  expiresAt: Date | null;
  orderUses: OrderUse[];
};

export type Verdict = { keep: true; reason: string } | { keep: false; reason: string };

const ACTIVE = new Set(["paid", "processing_artwork", "ready_for_fulfillment", "submitted_to_fulfillment", "in_production"]);
const FULFILLED = new Set(["shipped", "delivered"]);
const CLOSED = new Set(["cancelled", "failed", "pending_payment", "refunded"]);

export function orderUseVerdict(u: OrderUse, now: Date): Verdict {
  if (u.recordingRemoved) return { keep: false, reason: "removed on request" };
  if (ACTIVE.has(u.orderStatus)) return { keep: true, reason: "order in progress" };
  if (FULFILLED.has(u.orderStatus)) {
    if (u.hasQr) return { keep: true, reason: "printed QR code plays it" };
    const base = u.deliveredAt ?? (u.shippedAt ? new Date(u.shippedAt.getTime() + RETENTION_DAYS.assumedTransit * DAY) : null);
    if (!base) return { keep: true, reason: "awaiting delivery" };
    return now.getTime() > base.getTime() + RETENTION_DAYS.delivered * DAY ? { keep: false, reason: "no QR, delivered > 90 days" } : { keep: true, reason: "no QR, delivered recently" };
  }
  if (CLOSED.has(u.orderStatus)) {
    // A refunded order that shipped with a QR code still has a code on a wall.
    if (u.orderStatus === "refunded" && u.hasQr && u.shippedAt) return { keep: true, reason: "printed QR code plays it" };
    const at = u.closedAt ?? now;
    return now.getTime() > at.getTime() + RETENTION_DAYS.closed * DAY ? { keep: false, reason: "order closed > 30 days" } : { keep: true, reason: "order closed recently" };
  }
  return { keep: true, reason: `order ${u.orderStatus}` };
}

export function assetVerdict(a: AssetInput, now = new Date()): Verdict {
  if (a.status === "deleted" || a.status === "rejected") return { keep: true, reason: "already removed" };
  const verdicts = a.orderUses.map((u) => orderUseVerdict(u, now));
  const keeper = verdicts.find((v) => v.keep);
  if (keeper) return keeper;
  // Still inside its draft window (e.g. re-used in a new cart after a cancelled order).
  if (a.expiresAt && now <= a.expiresAt) return { keep: true, reason: "recent upload" };
  if (verdicts.length) return verdicts[0];
  if (a.expiresAt && now > a.expiresAt) return { keep: false, reason: a.status === "pending" ? "upload never completed" : "never ordered > 30 days" };
  return { keep: true, reason: "recent upload" };
}
