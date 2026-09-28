/**
 * Takedown: permanently removes the recording behind an order and switches off
 * its QR code (the code then shows "This recording has been removed"). Use when
 * a customer, or anyone recorded in it, asks — no questions asked.
 *
 *   npx tsx scripts/remove-recording.ts <orderId | listenToken> [--apply]
 */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

async function main() {
  const key = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!key || key.startsWith("--")) throw new Error("Usage: remove-recording.ts <orderId | listenToken> [--apply]");

  const order = await prisma.order.findFirst({ where: { OR: [{ id: key }, { listenToken: key }] } });
  if (!order) throw new Error(`No order found for ${key}`);

  const storage = path.resolve(process.cwd(), "storage") + path.sep;
  const file = order.audioPath ? path.resolve(process.cwd(), order.audioPath) : "";
  const exists = !!file && file.startsWith(storage) && fs.existsSync(file);
  const others = order.audioPath ? await prisma.order.count({ where: { audioPath: order.audioPath, id: { not: order.id } } }) : 0;

  console.log(`Order ${order.id} (${order.status})`);
  console.log(`  recording: ${order.audioPath || "—"} ${exists ? "" : "(already gone)"}`);
  if (others) console.log(`  note: ${others} other order(s) use the same file; it will stop playing for them too.`);
  if (!apply) return console.log("\nDry run. Re-run with --apply to remove it.");

  if (exists) fs.unlinkSync(file);
  let spec: Record<string, unknown> = {};
  try {
    spec = order.artworkSpec ? JSON.parse(order.artworkSpec) : {};
  } catch {}
  spec.recordingRemovedAt = new Date().toISOString();
  delete spec.listenUrl;
  await prisma.order.update({ where: { id: order.id }, data: { artworkSpec: JSON.stringify(spec) } });
  console.log("\nRemoved. The QR code for this order now shows “This recording has been removed.”");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
