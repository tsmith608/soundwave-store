/**
 * Design explorations that were rendered and critiqued but not selected for
 * the storefront. Kept so the reasoning is reproducible (see
 * docs/art-direction-2026.md and /dev/designs). Not shown to customers.
 */
import { formatDate } from "../dates";
import { F, fitSize, fitWrap } from "../fonts";
import { resample } from "../peaks";
import { circle, esc, line, lines, r, rect, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { bars, envelope, radial } from "../waves";
import { background, cw, minType, qrBlock } from "./common";

const baseFields = [
  { key: "title" as const, label: "Title", placeholder: "At Last", maxLength: 40 },
  { key: "subtitle" as const, label: "Subtitle", placeholder: "Etta James", maxLength: 40 },
  { key: "names" as const, label: "Names", placeholder: "Emma & James", maxLength: 36 },
  { key: "date" as const, label: "Date", placeholder: "2025-06-14", maxLength: 24 },
  { key: "message" as const, label: "Message", placeholder: "", maxLength: 80 },
];

const sample = {
  title: "At Last",
  subtitle: "Etta James",
  names: "Emma & James",
  date: "2025-06-14",
  message: "Our first dance, barefoot in the kitchen.",
};

// ─── Record: radial waveform as a vinyl disc ────────────────────────────────
export const record: DesignDefinition = {
  id: "x-record",
  name: "Record",
  direction: "Exploration",
  tagline: "Your song wrapped into a record.",
  rationale: "Rejected: the vinyl-record lyric print is already the category's most copied format (Blim & Blum, Etsy). Strong graphic, zero differentiation.",
  bestFor: ["Music lovers"],
  fields: baseFields,
  colorways: [cw("black", "Black", "#EFEBE4", "#151515", "#77736C", "#151515", "#1D1D1D")],
  sample,
  sampleSeed: "record",
  sampleKind: "song",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    const R = W * 0.36;
    const cy = H * 0.4;
    let s = background(ctx);
    s += circle(W / 2, cy, R, c.tone!);
    for (let k = 0; k < 5; k++) s += `<circle cx="${W / 2}" cy="${r(cy)}" r="${r(R * (0.5 + k * 0.1))}" fill="none" stroke="#333" stroke-width="1"/>`;
    s += radial(ctx.peaks, { cx: W / 2, cy, r0: R * 0.42, depth: R * 0.5, count: 200, color: c.paper, stroke: W * 0.0025 });
    s += circle(W / 2, cy, R * 0.3, "#B6412F");
    s += text(fields.title, { x: W / 2, y: cy + R * 0.05, size: fitSize(fields.title, F.display, R * 0.5, W * 0.05, W * 0.02), face: F.display, fill: c.paper, anchor: "middle" });
    s += text(fields.names, { x: W / 2, y: H * 0.86, size: W * 0.045, face: F.garamondItalic, fill: c.ink, anchor: "middle" });
    s += text(formatDate(fields.date), { x: W / 2, y: H * 0.9, size: minType(ctx) * 1.2, face: F.sansMedium, fill: c.muted, anchor: "middle", tracking: 0.3, upper: true });
    return s;
  },
};

// ─── Horizon: mirrored envelope as mountains and their reflection ───────────
export const horizon: DesignDefinition = {
  id: "x-horizon",
  name: "Horizon",
  direction: "Exploration",
  tagline: "Your recording as a mountain range over still water.",
  rationale:
    "Rejected for launch, kept as a candidate: attractive tonal landscape, but ‘soundwave mountains’ is a recognisable Etsy trope and the sun-disc landscape look is saturated in POD wall art.",
  bestFor: ["Travel", "Outdoors couples"],
  fields: baseFields,
  colorways: [cw("dusk", "Dusk", "#E9DDD0", "#2F2A33", "#7F766F", "#6E5B63", "#C98F6B")],
  sample,
  sampleSeed: "horizon",
  sampleKind: "voice",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    let s = background(ctx);
    const hy = H * 0.52;
    s += circle(W * 0.64, hy - H * 0.16, W * 0.1, c.tone!);
    s += envelope(ctx.peaks, { x: W * 0.08, y: hy, w: W * 0.84, h: H * 0.34, color: c.accent, mirror: false, count: 90 });
    s += `<g opacity="0.35">${envelope(ctx.peaks, { x: W * 0.08, y: hy, w: W * 0.84, h: H * 0.2, color: c.accent, count: 90 })}</g>`;
    s += line(W * 0.08, hy, W * 0.92, hy, c.ink, 1);
    s += text(fields.title, { x: W * 0.08, y: H * 0.78, size: W * 0.07, face: F.display, fill: c.ink });
    s += text(`${fields.names} · ${formatDate(fields.date)}`, { x: W * 0.08, y: H * 0.83, size: minType(ctx) * 1.2, face: F.sansMedium, fill: c.muted, tracking: 0.2, upper: true });
    return s;
  },
};

// ─── Colour Field: full-bleed bars in banded colour ─────────────────────────
export const colorField: DesignDefinition = {
  id: "x-color-field",
  name: "Colour Field",
  direction: "Exploration",
  tagline: "Your recording as a Rothko-quiet field of colour.",
  rationale:
    "Rejected: strongest as pure abstract art, but at gift sizes the personal element disappears — customers could not tell it is their recording, which fails the emotional brief.",
  bestFor: ["Modern interiors"],
  fields: baseFields,
  colorways: [cw("ochre", "Ochre", "#EDE6DA", "#2B2521", "#7A6F66", "#B8743E", "#D9B48F")],
  sample,
  sampleSeed: "field",
  sampleKind: "song",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    let s = background(ctx);
    const n = 48;
    const p = resample(ctx.peaks, n);
    const pitch = (W * 0.84) / n;
    const colors = [c.accent, c.tone!, "#8E4B34"];
    for (let i = 0; i < n; i++) {
      const h = H * 0.12 + p[i] * H * 0.5;
      s += rect(W * 0.08 + i * pitch, H * 0.72 - h, pitch * 0.92, h, colors[Math.floor((i / n) * 3)]);
    }
    s += text(`${fields.title} — ${fields.names}`, { x: W * 0.08, y: H * 0.8, size: minType(ctx) * 1.2, face: F.mono, fill: c.ink });
    s += text(formatDate(fields.date, "dots"), { x: W * 0.92, y: H * 0.8, size: minType(ctx) * 1.2, face: F.mono, fill: c.ink, anchor: "end" });
    return s;
  },
};

// ─── Big Date: typographic poster ───────────────────────────────────────────
export const bigDate: DesignDefinition = {
  id: "x-big-date",
  name: "Big Date",
  direction: "Exploration",
  tagline: "The date, enormous. Your recording underlines it.",
  rationale:
    "Held back: a confident Swiss typographic poster that photographs well on social. Overlaps Liner Notes as an editorial option; a strong candidate for a second editorial drop after launch data.",
  bestFor: ["Anniversary", "Birth date"],
  fields: baseFields,
  colorways: [cw("red", "Signal", "#EFEAE2", "#141414", "#6D6860", "#C23B22")],
  sample,
  sampleSeed: "bigdate",
  sampleKind: "voice",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    let s = background(ctx);
    const d = formatDate(fields.date, "dots").split(".");
    const m = W * 0.08;
    const size = W * 0.36;
    d.forEach((part, i) => {
      s += text(part, { x: m - size * 0.04, y: H * 0.26 + i * size * 0.84, size, face: F.display, fill: i === 1 ? c.accent : c.ink, tracking: -0.03 });
    });
    s += bars(ctx.peaks, { x: m, y: H * 0.86, w: W - m * 2, h: H * 0.06, count: 110, color: c.ink, gap: 0.5, round: false });
    s += text(`${fields.names} — ${fields.title}`, { x: m, y: H * 0.93, size: minType(ctx) * 1.3, face: F.sansMedium, fill: c.ink, tracking: 0.1, upper: true });
    return s;
  },
};

// ─── Score: waveform on a musical staff ─────────────────────────────────────
export const score: DesignDefinition = {
  id: "x-score",
  name: "Score",
  direction: "Exploration",
  tagline: "Your recording engraved like a page of sheet music.",
  rationale: "Rejected: reads as a novelty ‘music teacher gift’; the staff lines compete with the waveform and the page looks unfinished without real notation.",
  bestFor: ["Musicians"],
  fields: baseFields,
  colorways: [cw("paper", "Manuscript", "#F2EDE1", "#1F1D1A", "#77716A", "#1F1D1A")],
  sample,
  sampleSeed: "score",
  sampleKind: "song",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    let s = background(ctx);
    const m = W * 0.1;
    s += text(fields.title, { x: W / 2, y: H * 0.14, size: W * 0.07, face: F.garamondItalic, fill: c.ink, anchor: "middle" });
    s += text(fields.names, { x: W - m, y: H * 0.19, size: minType(ctx) * 1.3, face: F.garamond, fill: c.muted, anchor: "end" });
    const rows = 5;
    const chunk = Math.floor(ctx.peaks.length / rows);
    for (let k = 0; k < rows; k++) {
      const y0 = H * 0.28 + k * H * 0.13;
      for (let l = 0; l < 5; l++) s += line(m, y0 + l * H * 0.012, W - m, y0 + l * H * 0.012, c.muted, 1);
      s += bars(ctx.peaks.slice(k * chunk, (k + 1) * chunk), { x: m, y: y0 + H * 0.024, w: W - m * 2, h: H * 0.07, count: 60, color: c.ink, gap: 0.5 });
    }
    return s;
  },
};

// ─── Photo Editorial: magazine cover with photo ─────────────────────────────
export const photoEditorial: DesignDefinition = {
  id: "x-photo-editorial",
  name: "Photo Editorial",
  direction: "Exploration",
  tagline: "Your photo, magazine-cover style, with your recording along the bottom.",
  rationale:
    "Rejected: quality is hostage to the customer's photo (phone snapshots, busy backgrounds) and it collapses into the photo-canvas category we are trying to leave. Photo support lives in The Arch instead, where the shape contains it.",
  bestFor: ["Couples"],
  supportsPhoto: true,
  fields: baseFields,
  colorways: [cw("mono", "Mono", "#F1EEE8", "#161616", "#6F6B64", "#161616", "#BDB5AA")],
  sample,
  sampleSeed: "photo",
  sampleKind: "voice",
  render(ctx: RenderContext) {
    const { W, H, fields, colorway: c } = ctx;
    let s = background(ctx);
    const ph = H * 0.72;
    if (ctx.opts.photoHref) s += `<image href="${esc(ctx.opts.photoHref)}" x="0" y="0" width="${W}" height="${r(ph)}" preserveAspectRatio="xMidYMid slice"/>`;
    else s += rect(0, 0, W, ph, c.tone!);
    s += bars(ctx.peaks, { x: W * 0.06, y: ph - H * 0.05, w: W * 0.88, h: H * 0.06, count: 120, color: c.paper, gap: 0.5 });
    const t = fitWrap(fields.title, F.display, W * 0.88, 1, W * 0.12, W * 0.05);
    s += lines(t.lines, { x: W * 0.06, y: ph + H * 0.1, size: t.size, face: F.display, fill: c.ink, leading: t.size });
    s += text(`${fields.names} · ${formatDate(fields.date)}`, { x: W * 0.06, y: ph + H * 0.16, size: minType(ctx) * 1.3, face: F.sansMedium, fill: c.muted, tracking: 0.18, upper: true });
    const q = qrBlock(ctx, { x: W * 0.94, y: ph + H * 0.07, color: c.ink, align: "right" });
    s += q.svg;
    return s;
  },
};

export const EXPLORATIONS = [record, horizon, colorField, bigDate, score, photoEditorial];
