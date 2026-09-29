/**
 * Idempotent seed: catalogue (product + variants), design templates and, in
 * development only, a sample discount. Safe to re-run; existing prices and
 * SKUs edited in the admin are NOT overwritten unless --force is passed.
 *
 *   npx prisma db seed            (or: npm run db:seed)
 *   npx tsx prisma/seed.ts --force
 */
import { PrismaClient } from "@prisma/client";
import { PRINT_SIZES, FRAME_FINISHES } from "../src/lib/catalog";
import { DESIGNS } from "../src/lib/art";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

async function main() {
  await prisma.product.upsert({
    where: { id: "art-print" },
    create: {
      id: "art-print",
      slug: "custom-sound-art-print",
      name: "Custom keepsake art print",
      description: "Personalised artwork generated from the sound of your own recording, printed on archival fine-art paper, framed or unframed.",
    },
    update: {},
  });

  let sort = 0;
  for (const size of PRINT_SIZES) {
    for (const format of ["framed", "print"] as const) {
      const id = `${format}-${size.id}`;
      const data = {
        productId: "art-print",
        sku: `SWA-${format === "framed" ? "FR" : "PR"}-${size.id.toUpperCase()}`,
        format,
        sizeId: size.id,
        label: `${size.label} ${format === "framed" ? "framed print" : "art print"}`,
        widthIn: size.widthIn,
        heightIn: size.heightIn,
        priceCents: size.price[format],
        frameFinishes: format === "framed" ? FRAME_FINISHES.map((f) => f.id) : [],
        fulfillmentProvider: "prodigi",
        // ⚠ Placeholder SKUs — verify each in the Prodigi product catalogue before launch.
        fulfillmentSku: size.sku.prodigi[format],
        fulfillmentAttributes: format === "framed" ? { frameColorAttribute: "color", frameColors: { black: "black", natural: "natural", white: "white" } } : {},
        sortOrder: sort++,
      };
      await prisma.productVariant.upsert({ where: { id }, create: { id, ...data }, update: force ? data : { label: data.label } });
    }
  }

  for (const [i, d] of DESIGNS.entries()) {
    await prisma.designTemplate.upsert({
      where: { id: d.id },
      create: { id: d.id, name: d.name, version: d.templateVersion ?? 1, sortOrder: i },
      update: { name: d.name, version: d.templateVersion ?? 1 },
    });
  }

  if (process.env.NODE_ENV !== "production") {
    await prisma.discount.upsert({
      where: { code: "DEVTEST10" },
      create: { code: "DEVTEST10", description: "Development only: 10% off", type: "percent", value: 10 },
      update: {},
    });
  }

  console.log(`Seeded: ${await prisma.productVariant.count()} variants, ${await prisma.designTemplate.count()} design templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
