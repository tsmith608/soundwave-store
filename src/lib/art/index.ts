import { arch } from "./designs/arch";
import { EXPLORATIONS } from "./designs/explorations";
import { herbarium } from "./designs/herbarium";
import { inMemoriam } from "./designs/inMemoriam";
import { linerNotes } from "./designs/linerNotes";
import { nightOf } from "./designs/nightOf";
import { normalize, PEAK_RESOLUTION, resample, samplePeaks } from "./peaks";
import { doc } from "./svg";
import type { ArtFields, DesignDefinition, RenderOptions } from "./types";

export * from "./types";
export { samplePeaks, sanitizePeaks, decodePeaksFromBlob, PEAK_RESOLUTION } from "./peaks";

/**
 * Designs sold in the store, in display order.
 * Sep 2026 pivot: the company focuses on these two (see docs/owner-review.md).
 */
export const DESIGNS: DesignDefinition[] = [nightOf, herbarium];

/**
 * Version of the shared rendering engine (layout, fonts, QR). Recorded on every
 * generated print file together with the design's templateVersion.
 */
export const ART_ENGINE_VERSION = "2026.09.1";

/**
 * Previously sold, now retired from the storefront. Kept fully renderable so
 * any existing order still prints, and so they can be brought back.
 */
export const RETIRED_DESIGNS: DesignDefinition[] = [linerNotes, arch, inMemoriam];

/** Rendered and critiqued but never sold. Visible only at /dev/designs. */
export const EXPLORATION_DESIGNS: DesignDefinition[] = EXPLORATIONS;

const ALL = [...DESIGNS, ...RETIRED_DESIGNS, ...EXPLORATION_DESIGNS];

export function getDesign(id: string | null | undefined): DesignDefinition | undefined {
  if (!id) return undefined;
  return ALL.find((d) => d.id === id);
}

export function getSellableDesign(id: string | null | undefined): DesignDefinition | undefined {
  if (!id) return undefined;
  return DESIGNS.find((d) => d.id === id);
}

export const EMPTY_FIELDS: ArtFields = { title: "", subtitle: "", names: "", date: "", message: "", song: "" };

/** Trims and length-limits fields according to the design's specs. */
export function cleanFields(design: DesignDefinition, input: Partial<Record<keyof ArtFields, unknown>>): ArtFields {
  const out: ArtFields = { ...EMPTY_FIELDS };
  for (const spec of design.fields) {
    const raw = input[spec.key];
    const v = typeof raw === "string" ? raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim() : "";
    out[spec.key] = (typeof v.toWellFormed === "function" ? v.toWellFormed() : v).slice(0, spec.maxLength);
  }
  return out;
}

/**
 * Renders a complete standalone SVG document for a design.
 * `peaks` may be any length; it is normalised and resampled here.
 */
export function renderArtwork(design: DesignDefinition, fields: ArtFields, peaks: number[] | null | undefined, opts: RenderOptions): string {
  const W = 1200;
  const H = (W * opts.heightIn) / opts.widthIn;
  const colorway = design.colorways.find((c) => c.id === opts.colorwayId) ?? design.colorways[0];
  const source = peaks && peaks.length >= 8 ? peaks : samplePeaks(design.sampleSeed, design.sampleKind);
  const p = normalize(resample(source, PEAK_RESOLUTION));
  const uid = (opts.idPrefix ?? "a") + "-" + design.id;
  const body = design.render({ W, H, fields, peaks: p, colorway, opts, uid });
  return doc(W, H, opts.widthIn, opts.heightIn, body, "", opts.embedFontsCss ?? "");
}

/** Convenience for catalogue imagery: renders a design with its sample content. */
export function renderSample(design: DesignDefinition, opts: Partial<RenderOptions> = {}): string {
  return renderArtwork(design, design.sample, samplePeaks(design.sampleSeed, design.sampleKind), {
    widthIn: 12,
    heightIn: 16,
    showQr: true,
    ...opts,
  });
}
