import type { PrismaClient } from "@prisma/client";
import { PRINT_SIZES, FRAME_FINISHES } from "@/lib/catalog";
import { DESIGNS } from "@/lib/art";

/** Idempotent catalogue seed (also used by integration tests). */
export async function seedCatalog(prisma: PrismaClient, opts: { force?: boolean; devDiscount?: boolean } = {}) {
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
      await prisma.productVariant.upsert({ where: { id }, create: { id, ...data }, update: opts.force ? data : { label: data.label } });
    }
  }
  for (const [i, d] of DESIGNS.entries()) {
    await prisma.designTemplate.upsert({
      where: { id: d.id },
      create: { id: d.id, name: d.name, version: d.templateVersion ?? 1, sortOrder: i },
      update: { name: d.name, version: d.templateVersion ?? 1 },
    });
  }
  if (opts.devDiscount) {
    await prisma.discount.upsert({ where: { code: "DEVTEST10" }, create: { code: "DEVTEST10", description: "Development only: 10% off", type: "percent", value: 10 }, update: {} });
  }
}
