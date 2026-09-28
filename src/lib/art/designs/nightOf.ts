import { formatDate, moonPhase, moonPhaseName, parseDate } from "../dates";
import { F, fitSize, fitWrap } from "../fonts";
import { circle, lines, r, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { radial } from "../waves";
import { background, cw, minType, qrBlock } from "./common";

/** Lit part of the moon for phase p (0 new → 0.5 full → 1 new). */
export function moonLitPath(cx: number, cy: number, R: number, p: number): string {
  const lightRight = p < 0.5;
  const e = R * Math.cos(2 * Math.PI * p);
  const rx = Math.max(0.01, Math.abs(e));
  const sweep1 = lightRight ? 1 : 0;
  const sweep2 = lightRight ? (e > 0 ? 0 : 1) : e > 0 ? 1 : 0;
  return `M${r(cx)} ${r(cy - R)}A${r(R)} ${r(R)} 0 0 ${sweep1} ${r(cx)} ${r(cy + R)}A${r(rx)} ${r(R)} 0 0 ${sweep2} ${r(cx)} ${r(cy - R)}Z`;
}

/**
 * THE NIGHT OF — Celestial.
 * The moon exactly as it was on the customer's date, ringed by their
 * recording like a halo. Every celestial element is true (the phase and
 * illumination are computed from the date) — no scattered decorative stars.
 */
function render(ctx: RenderContext): string {
  const { W, H, fields, colorway: c } = ctx;
  const small = minType(ctx);
  let s = background(ctx);

  const R = W * 0.19;
  const cx = W / 2;
  const cy = H * 0.3;
  const d = parseDate(fields.date);
  const phase = d ? moonPhase(d) : 0.5;
  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  s += radial(ctx.peaks, { cx, cy, r0: R * 1.22, depth: R * 0.34, count: 168, color: c.ink, stroke: Math.max(1.4, W * 0.0026) });
  s += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(R * 1.13)}" fill="none" stroke="${c.muted}" stroke-width="${r(Math.max(0.8, W * 0.0009))}" opacity="0.6"/>`;
  s += circle(cx, cy, R, c.tone ?? c.muted);
  if (illum > 0.995) s += circle(cx, cy, R, c.accent);
  else if (illum > 0.005) s += `<path d="${moonLitPath(cx, cy, R, phase)}" fill="${c.accent}"/>`;

  let y = cy + R * 1.62 + H * 0.075;
  s += text(d ? "The night of" : "The night", { x: W / 2, y, size: small * 1.05, face: F.sansMedium, fill: c.muted, anchor: "middle", tracking: 0.4, upper: true });

  const dateStr = d ? formatDate(fields.date, "long") : fields.date || "";
  if (dateStr) {
    const ds = fitSize(dateStr, F.display, W * 0.8, W * 0.105, W * 0.05);
    y += ds * 1.05;
    s += text(dateStr, { x: W / 2, y, size: ds, face: F.display, fill: c.ink, anchor: "middle" });
  }
  if (fields.names) {
    const nf = fitWrap(fields.names, F.garamondItalic, W * 0.72, 2, W * 0.05, W * 0.03);
    y += nf.size * 1.35;
    s += lines(nf.lines, { x: W / 2, y, size: nf.size, face: F.garamondItalic, fill: c.ink, anchor: "middle", leading: nf.size * 1.05 });
    y += nf.size * 1.05 * (nf.lines.length - 1);
  }
  const facts = [d ? `${moonPhaseName(phase)} · ${Math.round(illum * 100)}% illuminated` : "", fields.title].filter(Boolean).join("   ·   ");
  if (facts) {
    y += W * 0.052;
    const fs = fitSize(facts, F.mono, W * 0.8, small * 1.05, small, 0.04);
    s += text(facts, { x: W / 2, y, size: fs, face: F.mono, fill: c.muted, anchor: "middle", tracking: 0.04 });
  }
  if (fields.message) {
    y += W * 0.05;
    const mf = fitWrap(fields.message, F.garamondItalic, W * 0.62, 2, W * 0.028, small * 1.1);
    s += lines(mf.lines, { x: W / 2, y, size: mf.size, face: F.garamondItalic, fill: c.ink, anchor: "middle", leading: mf.size * 1.25, opacity: 0.9 });
    y += mf.size * 1.25 * (mf.lines.length - 1);
  }
  const q = qrBlock(ctx, { x: W / 2, y: 0, color: c.ink, label: "Scan to listen", labelColor: c.muted });
  if (q.svg) s += `<g transform="translate(0 ${r(Math.max(y + W * 0.05, H - H * 0.055 - q.height))})">${q.svg}</g>`;
  return s;
}

export const nightOf: DesignDefinition = {
  id: "night-of",
  name: "The Night Of",
  direction: "Celestial",
  tagline: "The moon exactly as it was on your date, ringed by your recording.",
  rationale:
    "Star maps are the best-reviewed adjacent category (The Night Sky: ~9.7k Trustpilot reviews on one product) because the image is true to a date. This keeps that truth — real moon phase and illumination — and replaces random stars with the customer's own sound.",
  bestFor: ["The night we met", "Wedding night", "Anniversary", "A birth", "A night to remember someone"],
  fields: [
    { key: "date", label: "The date", placeholder: "2025-06-14", maxLength: 24, required: true, hint: "Pick an exact date so we can draw the real moon." },
    { key: "names", label: "Names", placeholder: "Emma & James", maxLength: 36 },
    { key: "title", label: "What you're hearing", placeholder: "At Last — Etta James", maxLength: 44 },
    { key: "message", label: "A short line", placeholder: "The night everything started.", maxLength: 80, multiline: true },
  ],
  colorways: [
    cw("midnight", "Midnight", "#121A2A", "#EEE7D6", "#8C94A6", "#EFE6D0", "#243049"),
    cw("dawn", "Dawn", "#EEE8DF", "#2A2F3A", "#7C7F87", "#C29A6B", "#DCD4C8"),
    cw("plum", "Plum Night", "#2A1E29", "#F0E3D6", "#A08E98", "#F1DCC8", "#3B2B39"),
  ],
  sample: {
    date: "2025-06-14",
    names: "Emma & James",
    title: "At Last — Etta James",
    message: "The night everything started.",
    subtitle: "",
  },
  sampleSeed: "night-of-emma",
  sampleKind: "song",
  render,
};
