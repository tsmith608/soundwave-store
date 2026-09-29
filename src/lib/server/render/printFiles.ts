import type { Prisma } from "@prisma/client";
import { ART_ENGINE_VERSION, getDesign, renderArtwork, sanitizePeaks, type ArtFields } from "@/lib/art";
import { embeddedFontCss, launch, svgToPdfBuffer, svgToPngBuffer, withBleed } from "@/lib/art/node";
import { prisma } from "../db";
import { sha256 } from "../crypto";
import { getEnv } from "../env";
import { log } from "../log";
import { enqueue, PermanentJobError } from "../jobs/queue";
import { renderKey, storage } from "../storage";
import { noteEvent, transition } from "../orders/state";

export interface ArtworkSpec {
  version: number;
  engineVersion: string;
  designId: string;
  templateVersion: number;
  colorwayId: string;
  fields: ArtFields;
  peaks: number[];
  showQr: boolean;
  qrStyle: "discreet" | "standard";
  qrUrl: string | null;
  listenUrl: string | null;
  sizeId: string;
  format: "print" | "framed";
  frameFinish: string | null;
  widthIn: number;
  heightIn: number;
}

/** Renders the exact purchased spec to SVG (deterministic: fonts embedded, peaks frozen). */
export function specToSvg(spec: ArtworkSpec): string {
  const design = getDesign(spec.designId);
  if (!design) throw new PermanentJobError(`Unknown design ${spec.designId}`);
  const peaks = sanitizePeaks(spec.peaks);
  if (!peaks) throw new PermanentJobError("Artwork spec has no usable waveform");
  return renderArtwork(design, spec.fields, peaks, {
    widthIn: spec.widthIn,
    heightIn: spec.heightIn,
    colorwayId: spec.colorwayId,
    showQr: spec.showQr && Boolean(spec.qrUrl),
    qrStyle: spec.qrStyle,
    qrUrl: spec.qrUrl ?? undefined,
    embedFontsCss: embeddedFontCss(),
  });
}

/**
 * Job: produce production files for every item of a paid order.
 * Idempotent — items that already have print files are skipped, and files
 * are immutable once written (a re-render creates new rows; submission uses the newest).
 */
export async function renderOrder(orderId: string, opts: { force?: boolean } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true, generatedAssets: true } } } });
  if (!order) throw new PermanentJobError(`Order ${orderId} not found`);
  if (!["paid", "processing_artwork", "ready_for_fulfillment"].includes(order.status)) {
    log.info("render_skipped", { orderId, status: order.status });
    return;
  }
  if (order.status === "paid") await prisma.$transaction((tx) => transition(tx, orderId, "processing_artwork", { actor: "worker", message: "Rendering print files." }));
  if (order.status === "ready_for_fulfillment" && opts.force) await prisma.$transaction((tx) => transition(tx, orderId, "processing_artwork", { actor: "worker", message: "Re-rendering print files." }));

  const store = await storage();
  const browser = await launch();
  try {
    for (const item of order.items) {
      const have = new Set(item.generatedAssets.map((a) => a.kind));
      if (!opts.force && have.has("print_png") && have.has("print_pdf")) continue;
      const spec = item.artworkSpec as unknown as ArtworkSpec;
      const design = getDesign(spec.designId);
      const currentVersion = design?.templateVersion ?? 1;
      if (currentVersion !== spec.templateVersion) {
        // Never let a later design change silently alter a purchased piece.
        await prisma.order.update({ where: { id: orderId }, data: { attentionReason: "template_version_mismatch" } });
        await noteEvent(orderId, "error", "worker", `Design ${spec.designId} is now v${currentVersion} but the order bought v${spec.templateVersion}. Render manually from the matching code version.`);
        throw new PermanentJobError("Template version mismatch");
      }
      const colorway = design!.colorways.find((c) => c.id === spec.colorwayId) ?? design!.colorways[0];
      const svg = specToSvg(spec);
      const bleed = Number(item.variant.bleedIn);
      const dpi = item.variant.printDpi;
      const print = withBleed(svg, spec.widthIn, spec.heightIn, bleed, colorway.paper);
      const rendererVersion = `${ART_ENGINE_VERSION}+${spec.designId}@v${spec.templateVersion}`;

      const pdf = await svgToPdfBuffer(browser, print.svg, print.widthIn, print.heightIn);
      const png = await svgToPngBuffer(browser, print.svg, print.widthIn, print.heightIn, dpi);
      const preview = await svgToPngBuffer(browser, svg, spec.widthIn, spec.heightIn, Math.round(900 / spec.widthIn));

      const files: { kind: "print_pdf" | "print_png" | "preview_png"; buf: Buffer; mime: string; ext: string; w?: number; h?: number; dpi?: number; wi: number; hi: number }[] = [
        { kind: "print_pdf", buf: pdf, mime: "application/pdf", ext: "pdf", wi: print.widthIn, hi: print.heightIn },
        { kind: "print_png", buf: png.png, mime: "image/png", ext: "png", w: png.widthPx, h: png.heightPx, dpi, wi: print.widthIn, hi: print.heightIn },
        { kind: "preview_png", buf: preview.png, mime: "image/png", ext: "png", w: preview.widthPx, h: preview.heightPx, wi: spec.widthIn, hi: spec.heightIn },
      ];
      for (const f of files) {
        const key = renderKey(order.number, item.id, f.kind === "print_pdf" ? "print-pdf" : f.kind === "print_png" ? "print-png" : "preview", f.ext);
        await store.put(key, f.buf, f.mime);
        await prisma.generatedAsset.create({
          data: {
            orderItemId: item.id,
            kind: f.kind,
            storageKey: key,
            mimeType: f.mime,
            sizeBytes: f.buf.length,
            widthPx: f.w ?? null,
            heightPx: f.h ?? null,
            widthIn: f.wi,
            heightIn: f.hi,
            dpi: f.dpi ?? null,
            sha256: sha256(f.buf),
            rendererVersion,
          },
        });
      }
      log.info("item_rendered", { orderId, itemId: item.id, pdfBytes: pdf.length, pngBytes: png.png.length, px: `${png.widthPx}x${png.heightPx}` });
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  await prisma.$transaction(async (tx) => {
    await transition(tx, orderId, "ready_for_fulfillment", { actor: "worker", message: "Print files ready." });
    if (getEnv().FULFILLMENT_AUTO_SUBMIT) await enqueue(tx, "submit_fulfillment", { orderId } as Prisma.InputJsonValue, { dedupeKey: `submit_fulfillment:${orderId}` });
  });
}
