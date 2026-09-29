/**
 * Applies the upload retention policy (src/lib/retention.ts) now. The worker
 * already does this every 10 minutes; this is for manual runs.
 *   npm run uploads:cleanup            # dry run
 *   npm run uploads:cleanup -- --apply # delete
 */
import { prisma } from "../src/lib/server/db";
import { runRetention } from "../src/lib/server/retention";

(async () => {
  const apply = process.argv.includes("--apply");
  const res = await runRetention({ apply });
  for (const r of res) console.log(`${apply ? "deleted" : "would delete"}  ${r.id}  (${(r.bytes / 1e6).toFixed(1)} MB)  — ${r.reason}`);
  console.log(`\n${res.length} recording(s) ${apply ? "deleted" : "to delete"}.${!apply && res.length ? " Re-run with --apply." : ""}`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
