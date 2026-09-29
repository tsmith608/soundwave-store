/**
 * Idempotent seed: catalogue (product + variants), design templates and, in
 * development only, a sample discount (DEVTEST10). Prices/SKUs edited in the
 * admin are NOT overwritten unless --force is passed.
 *
 *   npm run db:seed            npx tsx prisma/seed.ts --force
 */
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../src/lib/server/seed";

const prisma = new PrismaClient();

seedCatalog(prisma, { force: process.argv.includes("--force"), devDiscount: process.env.NODE_ENV !== "production" })
  .then(async () => console.log(`Seeded: ${await prisma.productVariant.count()} variants, ${await prisma.designTemplate.count()} design templates.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
