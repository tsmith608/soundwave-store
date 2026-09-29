import { assetVerdict, type OrderUse } from "@/lib/retention";
import { prisma } from "./db";
import { log } from "./log";
import { deleteAssetBytes } from "./media";

/** Applies the retention policy to every live asset. Dry-run by default. */
export async function runRetention(opts: { apply: boolean; now?: Date; batch?: number }) {
  const now = opts.now ?? new Date();
  let cursor: string | undefined;
  const results: { id: string; reason: string; bytes: number }[] = [];
  for (;;) {
    const assets = await prisma.uploadedAsset.findMany({
      where: { status: { in: ["pending", "ready"] } },
      orderBy: { id: "asc" },
      take: opts.batch ?? 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { orderItems: { include: { order: { include: { shipments: true } } } } },
    });
    if (!assets.length) break;
    for (const a of assets) {
      const uses: OrderUse[] = a.orderItems.map((it) => ({
        orderStatus: it.order.status,
        hasQr: Boolean(it.listenToken),
        recordingRemoved: Boolean(it.recordingRemovedAt),
        deliveredAt: it.order.shipments.find((s) => s.deliveredAt)?.deliveredAt ?? null,
        shippedAt: it.order.shipments.find((s) => s.shippedAt)?.shippedAt ?? null,
        closedAt: it.order.cancelledAt ?? (["failed", "pending_payment", "refunded"].includes(it.order.status) ? it.order.updatedAt : null),
      }));
      const v = assetVerdict({ status: a.status, expiresAt: a.expiresAt, orderUses: uses }, now);
      if (v.keep) continue;
      results.push({ id: a.id, reason: v.reason, bytes: a.sizeBytes });
      if (opts.apply) {
        await deleteAssetBytes(a.id, `retention: ${v.reason}`);
        await prisma.project.updateMany({ where: { audioAssetId: a.id, status: "draft" }, data: { audioAssetId: null } });
      }
    }
    cursor = assets[assets.length - 1].id;
  }
  if (results.length) log.info("retention_run", { apply: opts.apply, count: results.length, bytes: results.reduce((s, r) => s + r.bytes, 0) });
  return results;
}
