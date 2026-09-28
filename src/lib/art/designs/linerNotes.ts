import { formatDate } from "../dates";
import { F, fitSize, fitWrap } from "../fonts";
import { line, lines, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { bars } from "../waves";
import { background, cw, minType, qrBlock } from "./common";

/**
 * LINER NOTES — Editorial.
 * Built like the back of a record sleeve or a gallery wall label: a large
 * editorial serif title set flush-left, a dense run of flat-cut bars across
 * the lower third, and a credits grid in monospace. Asymmetric, typographic,
 * no ornament. The waveform is one element in a grid, not a centrepiece.
 */
function render(ctx: RenderContext): string {
  const { W, H, fields, colorway: c } = ctx;
  const m = W * 0.085;
  const inner = W - m * 2;
  const small = minType(ctx, 0.0142);
  let s = background(ctx);

  // Top rail: index number + date
  const railY = m + small;
  s += text(fields.subtitle ? "Side A" : "Track 01", { x: m, y: railY, size: small, face: F.mono, fill: c.muted, tracking: 0.08, upper: true });
  s += text(formatDate(fields.date, "dots"), { x: W - m, y: railY, size: small, face: F.mono, fill: c.muted, anchor: "end", tracking: 0.08 });
  s += line(m, railY + small * 0.9, W - m, railY + small * 0.9, c.ink, Math.max(1.2, W * 0.0012));

  // Title — as large as the words allow, up to three lines
  const titleTop = railY + H * 0.1;
  const title = fields.title || "Untitled";
  const fit = fitWrap(title, F.display, inner, title.length > 24 ? 3 : 2, title.length <= 12 ? W * 0.215 : W * 0.165, W * 0.075, -0.01);
  const leading = fit.size * 0.92;
  const titleBase = titleTop + fit.size * 0.72;
  s += lines(fit.lines, { x: m - fit.size * 0.03, y: titleBase, size: fit.size, face: F.display, fill: c.ink, leading, tracking: -0.01 });
  let y = titleBase + leading * (fit.lines.length - 1);

  if (fields.subtitle) {
    const subSize = fitSize(fields.subtitle, F.displayItalic, inner, W * 0.052, W * 0.03);
    y += subSize * 1.45;
    s += text(fields.subtitle, { x: m, y, size: subSize, face: F.displayItalic, fill: c.muted });
  }

  // Waveform band: flat-cut bars, lower third
  const bandH = H * 0.2;
  const bandY = Math.max(y + H * 0.08 + bandH / 2, H * 0.6);
  s += bars(ctx.peaks, { x: m, y: bandY, w: inner, h: bandH, count: Math.round(inner / (W * 0.0115)), color: c.accent, gap: 0.42, round: false, minH: W * 0.004 });

  // Message, italic, set under the waveform like a pull quote
  let credY = bandY + bandH / 2 + H * 0.05;
  if (fields.message) {
    const msg = fitWrap(`“${fields.message}”`, F.displayItalic, inner * 0.8, 2, W * 0.034, W * 0.022);
    s += lines(msg.lines, { x: m, y: credY + msg.size * 0.2, size: msg.size, face: F.displayItalic, fill: c.ink, leading: msg.size * 1.2 });
    credY += msg.size * 1.2 * msg.lines.length + H * 0.02;
  }

  // Credits grid
  const colW = inner / 3;
  const ruleY = Math.min(credY, H - m - H * 0.1);
  s += line(m, ruleY, W - m, ruleY, c.ink, Math.max(1, W * 0.0009));
  const labelY = ruleY + small * 2;
  const valueSize = Math.max(small * 1.15, W * 0.018);
  const valueY = labelY + valueSize * 1.6;
  const cols: [string, string][] = [
    ["For", fields.names],
    ["Recorded", formatDate(fields.date, "long")],
  ];
  cols.forEach(([label, value], i) => {
    if (!value) return;
    const x = m + colW * i;
    s += text(label, { x, y: labelY, size: small, face: F.mono, fill: c.muted, tracking: 0.08, upper: true });
    const vs = fitSize(value, F.monoMedium, colW - W * 0.02, valueSize, small);
    s += text(value, { x, y: valueY, size: vs, face: F.monoMedium, fill: c.ink });
  });
  const q = qrBlock(ctx, { x: W - m, y: labelY - small * 0.8, color: c.ink, align: "right", minIn: 0.8 });
  if (q.svg) {
    s += q.svg;
    s += text("Scan to play", {
      x: W - m - q.size - W * 0.015,
      y: labelY,
      size: small,
      face: F.mono,
      fill: c.muted,
      anchor: "end",
      tracking: 0.08,
      upper: true,
    });
  }
  return s;
}

export const linerNotes: DesignDefinition = {
  id: "liner-notes",
  name: "Liner Notes",
  direction: "Editorial",
  tagline: "Typeset like the back of a record sleeve. Big title, clean grid, your song in the lower third.",
  rationale:
    "Typography-led, asymmetric editorial layout matching 2026 stationery and graphic trends (serif revival, magazine grids). Reads as a music poster first, a personalised gift second — the opposite of the centred-waveform Etsy template.",
  bestFor: ["First dance song", "Anniversary", "Music lovers", "Partner"],
  fields: [
    { key: "title", label: "Song or title", placeholder: "At Last", maxLength: 48, required: true },
    { key: "subtitle", label: "Artist", placeholder: "Etta James", maxLength: 40 },
    { key: "names", label: "For", placeholder: "Emma & James", maxLength: 32 },
    { key: "date", label: "Date", placeholder: "2025-06-14", maxLength: 24, hint: "Pick a date, or type something like “Summer 2019”." },
    { key: "message", label: "A line underneath", placeholder: "Our first dance, barefoot in the kitchen.", maxLength: 90, multiline: true },
  ],
  colorways: [
    cw("bone", "Bone & Ink", "#F1ECE3", "#1B1A18", "#6E685F", "#1B1A18"),
    cw("ink", "Ink & Bone", "#171614", "#EEE7DA", "#9C958A", "#EEE7DA"),
    cw("clay", "Clay", "#EADFD2", "#35251E", "#7C6A5E", "#A34E2E"),
  ],
  sample: {
    title: "At Last",
    subtitle: "Etta James",
    names: "Emma & James",
    date: "2025-06-14",
    message: "Our first dance, barefoot in the kitchen.",
  },
  sampleSeed: "at-last",
  sampleKind: "song",
  render,
};
