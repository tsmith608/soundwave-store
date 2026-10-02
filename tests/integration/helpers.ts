import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/server/db";
import { seedCatalog } from "../../src/lib/server/seed";
import { samplePeaks } from "../../src/lib/art";

export { prisma };

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await seedCatalog(prisma);
}

let n = 0;
/** A pending-payment order with one item, as startCheckout would create it. */
export async function makePendingOrder(opts: { discountCode?: string; totalCents?: number; qr?: boolean; digital?: boolean } = {}) {
  n++;
  const d = opts.digital === true;
  const variantId = d ? "digital-12x16" : "framed-12x16";
  const asset = await prisma.uploadedAsset.create({ data: { storageKey: `uploads/test/${Date.now()}-${n}.wav`, mimeType: "audio/wav", sizeBytes: 5000, status: "ready", ownerKeyHash: "dev1" } });
  const project = await prisma.project.create({ data: { ownerKeyHash: "dev1", designId: "herbarium", colorwayId: "herbarium", fields: { title: "Test" }, options: { showQr: true }, peaks: samplePeaks("x", "voice"), audioAssetId: asset.id, rightsConfirmedAt: new Date() } });
  const cart = await prisma.cart.create({ data: { tokenHash: `cart-${Date.now()}-${n}`, items: { create: { projectId: project.id, variantId, frameFinish: d ? null : "black" } } } });
  const spec = { version: 2, designId: "herbarium", templateVersion: 1, colorwayId: "herbarium", fields: { title: "Test", subtitle: "", names: "", date: "", message: "" }, peaks: samplePeaks("x", "voice"), showQr: opts.qr !== false, qrStyle: "discreet", qrUrl: "http://localhost:3999/l/tok", listenUrl: null, sizeId: "12x16", format: d ? "digital" : "framed", frameFinish: d ? null : "black", widthIn: 12, heightIn: 16 };
  const total = opts.totalCents ?? (d ? 1900 : 9900);
  return prisma.order.create({
    data: {
      number: `SW-T${Date.now().toString().slice(-6)}${n}`,
      cartId: cart.id,
      email: "",
      status: "pending_payment",
      subtotalCents: total,
      totalCents: total,
      discountCode: opts.discountCode,
      stripeCheckoutSessionId: `cs_fake_test_${Date.now()}_${n}`,
      pricingSnapshot: {},
      items: {
        create: {
          variantId,
          productName: d ? "Digital file (PNG + PDF)" : '12 × 16" framed print',
          sku: d ? "SWA-DG-12X16" : "SWA-FR-12X16",
          format: d ? "digital" : "framed",
          sizeId: "12x16",
          frameFinish: d ? null : "black",
          quantity: 1,
          unitPriceCents: total,
          lineTotalCents: total,
          designId: "herbarium",
          designName: "Herbarium",
          templateVersion: 1,
          artworkSpec: spec as unknown as Prisma.InputJsonValue,
          audioAssetId: asset.id,
          listenToken: opts.qr === false ? null : `tok${Date.now()}${n}`,
          rightsConfirmedAt: new Date(),
        },
      },
    },
    include: { items: true },
  });
}
