import { prisma } from "../db";
import { deleteAssetBytes } from "../media";
import { noteEvent } from "./state";

/** Removes the recording(s) behind an order and disables the QR playback page. */
export async function removeRecording(key: string, opts: { apply: boolean; actor: string }) {
  const item = await prisma.orderItem.findUnique({ where: { listenToken: key } });
  const order = item
    ? await prisma.order.findUnique({ where: { id: item.orderId }, include: { items: true } })
    : await prisma.order.findFirst({ where: { OR: [{ id: key }, { number: key.toUpperCase() }] }, include: { items: true } });
  if (!order) throw new Error(`No order found for ${key}`);
  const items = item ? order.items.filter((i) => i.id === item.id) : order.items;
  const summary = { order: order.number, items: items.map((i) => ({ id: i.id, hasRecording: Boolean(i.audioAssetId), removedAt: i.recordingRemovedAt })) };
  if (!opts.apply) return summary;
  for (const i of items) {
    await prisma.orderItem.update({ where: { id: i.id }, data: { recordingRemovedAt: new Date() } });
    if (i.audioAssetId) {
      const otherUses = await prisma.orderItem.count({ where: { audioAssetId: i.audioAssetId, id: { not: i.id }, recordingRemovedAt: null } });
      if (!otherUses) await deleteAssetBytes(i.audioAssetId, "takedown");
    }
  }
  await noteEvent(order.id, "note", opts.actor, `Recording removed on request (${items.length} item${items.length > 1 ? "s" : ""}); QR playback disabled.`);
  return { ...summary, removed: true };
}
