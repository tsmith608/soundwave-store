/**
 * Upload retention policy (owner decision, 28 Sep 2026):
 *
 * - A recording behind a printed QR code is kept for as long as the business
 *   runs — the code must keep playing it.
 * - A recording on an order without a QR code is deleted 90 days after the
 *   order is delivered (the order's last update is used as the delivery date).
 * - Cancelled orders and abandoned checkouts: deleted after 30 days.
 * - Uploads never attached to an order (someone tried the studio and left):
 *   deleted after 30 days.
 * - Anyone can ask for a recording to be removed at any time
 *   (scripts/remove-recording.ts) — that overrides everything above.
 */
export const RETENTION_DAYS = { delivered: 90, cancelled: 30, abandoned: 30, orphan: 30 } as const;

const DAY = 24 * 60 * 60 * 1000;

export interface RetentionOrder {
  status: string;
  artworkSpec: string | null;
  updatedAt: Date;
}

export type RetentionVerdict = { keep: true; reason: string } | { keep: false; reason: string };

export function hasQr(order: Pick<RetentionOrder, "artworkSpec">): boolean {
  // Legacy orders (before curated designs) had no spec and always printed a code.
  if (!order.artworkSpec) return true;
  try {
    const spec = JSON.parse(order.artworkSpec);
    if (spec.recordingRemovedAt) return false;
    return spec.showQr !== false;
  } catch {
    return true; // unreadable spec: err on the side of keeping the recording
  }
}

/** Decide whether one order's recording may be deleted. */
export function orderVerdict(order: RetentionOrder, now = new Date()): RetentionVerdict {
  const age = (now.getTime() - order.updatedAt.getTime()) / DAY;
  if (order.status === "cancelled") {
    return age > RETENTION_DAYS.cancelled ? { keep: false, reason: "cancelled > 30 days" } : { keep: true, reason: "cancelled recently" };
  }
  if (order.status === "pending_payment") {
    return age > RETENTION_DAYS.abandoned ? { keep: false, reason: "abandoned checkout > 30 days" } : { keep: true, reason: "checkout in progress" };
  }
  if (hasQr(order)) return { keep: true, reason: "printed QR code plays it" };
  if (order.status === "delivered") {
    return age > RETENTION_DAYS.delivered ? { keep: false, reason: "no QR, delivered > 90 days" } : { keep: true, reason: "no QR, delivered recently" };
  }
  return { keep: true, reason: `order ${order.status}` };
}

/**
 * A file shared by several orders is kept if any of them needs it.
 * Files no order references are deleted after 30 days.
 */
export function fileVerdict(orders: RetentionOrder[], fileModified: Date, now = new Date()): RetentionVerdict {
  if (orders.length === 0) {
    const age = (now.getTime() - fileModified.getTime()) / DAY;
    return age > RETENTION_DAYS.orphan ? { keep: false, reason: "never ordered > 30 days" } : { keep: true, reason: "recent upload" };
  }
  const verdicts = orders.map((o) => orderVerdict(o, now));
  const keeper = verdicts.find((v) => v.keep);
  return keeper ?? verdicts[0];
}
