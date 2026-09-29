/**
 * Takedown: permanently removes the recording behind an order (all items, or
 * one listen token) and switches off its QR code. No questions asked.
 *   npm run uploads:remove -- <order number | order id | listen token> [--apply]
 */
import { prisma } from "../src/lib/server/db";
import { removeRecording } from "../src/lib/server/orders/takedown";

(async () => {
  const key = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!key || key.startsWith("--")) throw new Error("Usage: remove-recording.ts <order number | order id | listen token> [--apply]");
  const res = await removeRecording(key, { apply, actor: "cli" });
  console.log(JSON.stringify(res, null, 2));
  if (!apply) console.log("\nDry run. Re-run with --apply to remove it.");
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
