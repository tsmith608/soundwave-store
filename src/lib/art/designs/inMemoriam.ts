import { F, fitSize, fitWrap } from "../fonts";
import { line, lines, r, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { trace } from "../waves";
import { background, cw, minType, qrBlock } from "./common";

/**
 * IN MEMORIAM — Memorial.
 * Quiet and typographic, closer to a fine memorial card or an engraved stone
 * than to a gift print. The person's name carries the piece. Their voice is a
 * single fine line, and the words they actually said are set beneath it.
 * No hearts, no doves, no "always in our hearts" boilerplate.
 */
function render(ctx: RenderContext): string {
  const { W, H, fields, colorway: c } = ctx;
  const small = minType(ctx);
  let s = background(ctx);

  let y = H * 0.3;
  const name = fields.names || fields.title || "";
  if (name) {
    const nf = fitWrap(name, F.garamond, W * 0.78, 2, W * 0.098, W * 0.052, 0.01);
    s += lines(nf.lines, { x: W / 2, y, size: nf.size, face: F.garamond, fill: c.ink, anchor: "middle", leading: nf.size * 1.06, tracking: 0.01 });
    y += nf.size * 1.06 * (nf.lines.length - 1);
  }
  if (fields.date) {
    y += W * 0.068;
    const ds = fitSize(fields.date, F.sansMedium, W * 0.6, W * 0.021, small, 0.36);
    s += text(fields.date, { x: W / 2, y, size: ds, face: F.sansMedium, fill: c.muted, anchor: "middle", tracking: 0.36, upper: true });
  }

  // The voice: one fine trace between two short rules
  const ly = Math.max(y + H * 0.1, H * 0.5);
  const lw = W * 0.64;
  const lx = (W - lw) / 2;
  const hair = Math.max(0.9, W * 0.001);
  s += line(W * 0.1, ly, lx - W * 0.03, ly, c.muted, hair, 'opacity="0.6"');
  s += line(lx + lw + W * 0.03, ly, W * 0.9, ly, c.muted, hair, 'opacity="0.6"');
  s += trace(ctx.peaks, { x: lx, y: ly, w: lw, h: H * 0.085, count: 300, color: c.accent, stroke: Math.max(1.1, W * 0.0017) });

  y = ly + H * 0.07;
  if (fields.subtitle) {
    const ss = fitSize(fields.subtitle, F.mono, W * 0.6, small * 1.05, small, 0.08);
    s += text(fields.subtitle, { x: W / 2, y, size: ss, face: F.mono, fill: c.muted, anchor: "middle", tracking: 0.08, upper: true });
    y += W * 0.07;
  } else y += W * 0.03;

  if (fields.message) {
    const mf = fitWrap(`“${fields.message}”`, F.garamondItalic, W * 0.66, 3, W * 0.046, W * 0.028);
    y += mf.size * 0.3;
    s += lines(mf.lines, { x: W / 2, y, size: mf.size, face: F.garamondItalic, fill: c.ink, anchor: "middle", leading: mf.size * 1.28 });
    y += mf.size * 1.28 * (mf.lines.length - 1);
  }

  const q = qrBlock(ctx, { x: W / 2, y: 0, color: c.ink, label: "Scan to listen", labelColor: c.muted });
  if (q.svg) s += `<g transform="translate(0 ${r(Math.max(y + W * 0.06, H - H * 0.06 - q.height))})">${q.svg}</g>`;
  return s;
}

export const inMemoriam: DesignDefinition = {
  id: "in-memoriam",
  name: "In Memoriam",
  direction: "Memorial",
  tagline: "Their name, their voice as a single line, and the words they actually said.",
  rationale:
    "Memorial is the highest-emotion use case in the category (Etsy has dedicated ‘voicemail memorial gift’ markets) but competitors default to hearts, photo collages and stock phrases. Minimal memorial design is the 2026 norm; the customer's real words do the emotional work.",
  bestFor: ["Voicemail memorial", "Parent or grandparent", "Pet memorial", "Sympathy gift"],
  fields: [
    { key: "names", label: "Their name", placeholder: "Margaret Ellen Hayes", maxLength: 40, required: true },
    { key: "date", label: "Years", placeholder: "1941 — 2026", maxLength: 28, hint: "Anything you like: years, a full date, or leave blank." },
    { key: "subtitle", label: "About the recording", placeholder: "Voicemail · March 2019", maxLength: 40 },
    { key: "message", label: "Their words", placeholder: "Call me when you get home, sweetheart.", maxLength: 110, multiline: true, hint: "Often the most powerful line is what they said on the recording." },
  ],
  colorways: [
    cw("stone", "Stone", "#F1EFEA", "#262523", "#77736C", "#262523"),
    cw("linen", "Linen", "#EDE5D8", "#3A322B", "#83786C", "#6F5B47"),
    cw("slate", "Slate", "#23272B", "#ECE8E1", "#9A9C9D", "#D8D2C7"),
  ],
  sample: {
    names: "Margaret Ellen Hayes",
    date: "1941 — 2026",
    subtitle: "Voicemail · March 2019",
    message: "Call me when you get home, sweetheart. Love you.",
    title: "",
  },
  sampleSeed: "margaret-voicemail",
  sampleKind: "voice",
  render,
};
