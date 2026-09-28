/**
 * Applies the upload retention policy in src/lib/retention.ts.
 * Dry run by default — prints what it would delete. Run on a schedule
 * (e.g. daily cron on the NAS) with --apply.
 *
 *   npx tsx scripts/cleanup-uploads.ts            # dry run
 *   npx tsx scripts/cleanup-uploads.ts --apply    # delete
 */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { fileVerdict, type RetentionOrder } from "../src/lib/retention";

async function main() {
  const apply = process.argv.includes("--apply");
  const dir = path.resolve(process.cwd(), "storage", "uploads");
  if (!fs.existsSync(dir)) return console.log("No storage/uploads directory.");
  const files = fs.readdirSync(dir).filter((f) => /^aud_/.test(f));

  const orders = await prisma.order.findMany({ select: { id: true, audioPath: true, status: true, artworkSpec: true, updatedAt: true } });
  const byFile = new Map<string, (RetentionOrder & { id: string })[]>();
  for (const o of orders) {
    const name = path.basename(o.audioPath || "");
    if (!name) continue;
    byFile.set(name, [...(byFile.get(name) ?? []), o]);
  }

  let deleted = 0;
  let freed = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    const v = fileVerdict(byFile.get(f) ?? [], stat.mtime);
    if (v.keep) continue;
    console.log(`${apply ? "delete" : "would delete"}  ${f}  (${(stat.size / 1e6).toFixed(1)} MB)  — ${v.reason}`);
    if (apply) fs.unlinkSync(full);
    deleted++;
    freed += stat.size;
  }
  console.log(`\n${files.length} recordings checked · ${deleted} ${apply ? "deleted" : "to delete"} · ${(freed / 1e6).toFixed(1)} MB${apply ? " freed" : ""}`);
  if (!apply && deleted) console.log("Dry run. Re-run with --apply to delete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
