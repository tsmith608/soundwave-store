import { formatDate } from "../dates";
import { F, fitSize, fitWrap } from "../fonts";
import { resample, smooth } from "../peaks";
import { line, lines, r, rect, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { background, cw, minType, qrBlock } from "./common";

type P = [number, number];

function bez(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function bezTangent(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

/** Almond leaf from base along angle a, with a slight natural curl. */
function leaf(base: P, a: number, len: number, widthRatio: number, curl: number): { body: string; rib: string } {
  const tip: P = [base[0] + Math.cos(a + curl) * len, base[1] + Math.sin(a + curl) * len];
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const w = len * widthRatio;
  const c1a: P = [base[0] + Math.cos(a) * len * 0.3 + nx * w, base[1] + Math.sin(a) * len * 0.3 + ny * w];
  const c1b: P = [base[0] + Math.cos(a + curl * 0.6) * len * 0.78 + nx * w * 0.75, base[1] + Math.sin(a + curl * 0.6) * len * 0.78 + ny * w * 0.75];
  const c2a: P = [base[0] + Math.cos(a + curl * 0.6) * len * 0.78 - nx * w * 0.75, base[1] + Math.sin(a + curl * 0.6) * len * 0.78 - ny * w * 0.75];
  const c2b: P = [base[0] + Math.cos(a) * len * 0.3 - nx * w, base[1] + Math.sin(a) * len * 0.3 - ny * w];
  const body = `M${r(base[0])} ${r(base[1])}C${r(c1a[0])} ${r(c1a[1])} ${r(c1b[0])} ${r(c1b[1])} ${r(tip[0])} ${r(tip[1])}C${r(c2a[0])} ${r(c2a[1])} ${r(c2b[0])} ${r(c2b[1])} ${r(base[0])} ${r(base[1])}Z`;
  const ribEnd: P = [base[0] + Math.cos(a + curl * 0.7) * len * 0.82, base[1] + Math.sin(a + curl * 0.7) * len * 0.82];
  const ribMid: P = [base[0] + Math.cos(a + curl * 0.25) * len * 0.45, base[1] + Math.sin(a + curl * 0.25) * len * 0.45];
  const rib = `M${r(base[0])} ${r(base[1])}Q${r(ribMid[0])} ${r(ribMid[1])} ${r(ribEnd[0])} ${r(ribEnd[1])}`;
  return { body, rib };
}

/**
 * HERBARIUM — Botanical.
 * A pressed-specimen sheet. The recording is not drawn as a waveform at all:
 * it grows a single stem, and every leaf's length is the loudness of that
 * moment of the recording, read bottom to top. A museum specimen label holds
 * the words. Herbarium sheets and cyanotypes are an established wall-art
 * genre, so the piece stands on its own even to someone who never hears the
 * recording.
 */
function render(ctx: RenderContext): string {
  const { W, H, fields, colorway: c } = ctx;
  const m = W * 0.085;
  const small = minType(ctx);
  let s = background(ctx);

  // Stem geometry
  const base: P = [W * 0.37, H * 0.86];
  const top: P = [W * 0.45, H * 0.08];
  const c1: P = [W * 0.28, H * 0.62];
  const c2: P = [W * 0.56, H * 0.34];
  const stemW = Math.max(W * 0.0042, 2);

  const N = 26;
  const amps = smooth(resample(ctx.peaks, N), 1);
  let leaves = "";
  let ribs = "";
  for (let i = 0; i < N; i++) {
    const t = 0.06 + (i / (N - 1)) * 0.84;
    const p = bez(base, c1, c2, top, t);
    const tan = bezTangent(base, c1, c2, top, t);
    const stemAngle = Math.atan2(tan[1], tan[0]);
    const side = i % 2 === 0 ? 1 : -1;
    const spread = (52 + 10 * (1 - t)) * (Math.PI / 180);
    const a = stemAngle + side * spread;
    const taper = 1 - 0.5 * t;
    const len = W * (0.05 + amps[i] * 0.19) * taper;
    const lf = leaf(p, a, len, 0.3, side * -0.12);
    leaves += `<path d="${lf.body}"/>`;
    ribs += `<path d="${lf.rib}"/>`;
  }
  // terminal bud: three short leaves
  const tipTan = bezTangent(base, c1, c2, top, 1);
  const ta = Math.atan2(tipTan[1], tipTan[0]);
  for (const off of [-0.45, 0, 0.45]) {
    const lf = leaf(top, ta + off, W * 0.045, 0.28, off * -0.2);
    leaves += `<path d="${lf.body}"/>`;
    ribs += `<path d="${lf.rib}"/>`;
  }

  s += `<path d="M${r(base[0])} ${r(base[1])}C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(top[0])} ${r(top[1])}" fill="none" stroke="${c.ink}" stroke-width="${r(stemW)}" stroke-linecap="round"/>`;
  s += `<g fill="${c.tone ?? c.accent}">${leaves}</g>`;
  s += `<g fill="none" stroke="${c.paper}" stroke-width="${r(stemW * 0.45)}" stroke-linecap="round" opacity="0.75">${ribs}</g>`;
  // small root flick to ground the stem
  s += `<path d="M${r(base[0])} ${r(base[1])}q${r(-W * 0.012)} ${r(H * 0.012)} ${r(-W * 0.03)} ${r(H * 0.016)}M${r(base[0])} ${r(base[1])}q${r(W * 0.01)} ${r(H * 0.014)} ${r(W * 0.024)} ${r(H * 0.02)}" fill="none" stroke="${c.ink}" stroke-width="${r(stemW * 0.6)}" stroke-linecap="round"/>`;

  // Specimen label
  const lw = W * 0.4;
  const lx = W - m - lw;
  const pad = W * 0.026;
  const title = fields.title || "Untitled";
  const tf = fitWrap(title, F.garamondItalic, lw - pad * 2, 2, W * 0.05, W * 0.028);
  const rows: [string, string][] = [];
  if (fields.names) rows.push(["Collected by", fields.names]);
  if (fields.date) rows.push(["Date", formatDate(fields.date, "long")]);
  const rowH = small * 2.3;
  const msgFit = fields.message ? fitWrap(fields.message, F.garamondItalic, lw - pad * 2, 3, W * 0.024, small * 1.15) : null;
  const subH = fields.subtitle ? W * 0.028 * 1.6 : 0;
  const lh =
    pad * 1.2 + small * 1.2 + tf.size * 1.05 * tf.lines.length + subH + pad * 0.6 + rows.length * rowH + (msgFit ? msgFit.size * 1.3 * msgFit.lines.length + pad * 0.5 : 0) + pad * 0.7;
  const ly = H - m - lh;
  s += rect(lx, ly, lw, lh, "none", `stroke="${c.ink}" stroke-width="${r(Math.max(1, W * 0.0012))}"`);
  let y = ly + pad * 1.2 + small * 0.8;
  s += text("Specimen", { x: lx + pad, y, size: small, face: F.mono, fill: c.muted, tracking: 0.12, upper: true });
  s += text(formatDate(fields.date, "dots"), { x: lx + lw - pad, y, size: small, face: F.mono, fill: c.muted, anchor: "end" });
  y += tf.size * 1.12;
  s += lines(tf.lines, { x: lx + pad, y, size: tf.size, face: F.garamondItalic, fill: c.ink, leading: tf.size * 1.05 });
  y += tf.size * 1.05 * (tf.lines.length - 1);
  if (fields.subtitle) {
    const ss = fitSize(fields.subtitle, F.garamond, lw - pad * 2, W * 0.026, small);
    y += ss * 1.5;
    s += text(fields.subtitle, { x: lx + pad, y, size: ss, face: F.garamond, fill: c.muted });
  }
  y += pad * 0.6;
  s += line(lx + pad, y, lx + lw - pad, y, c.ink, Math.max(0.8, W * 0.0008));
  for (const [k, v] of rows) {
    y += rowH;
    s += text(k, { x: lx + pad, y, size: small, face: F.mono, fill: c.muted, tracking: 0.04, upper: true });
    const vs = fitSize(v, F.monoMedium, lw * 0.56, small * 1.08, small * 0.9);
    s += text(v, { x: lx + lw - pad, y, size: vs, face: F.monoMedium, fill: c.ink, anchor: "end" });
  }
  if (msgFit) {
    y += pad * 0.5 + msgFit.size * 1.3;
    s += lines(msgFit.lines, { x: lx + pad, y, size: msgFit.size, face: F.garamondItalic, fill: c.ink, leading: msgFit.size * 1.3 });
  }

  // Annotation + QR, bottom-left
  const q = qrBlock(ctx, { x: m, y: H - m - W * 0.11, color: c.ink, align: "left", label: "Scan to listen", labelColor: c.muted, minIn: 0.9 });
  if (q.svg) {
    const qy = H - m - q.height + small * 0.3;
    s += `<g transform="translate(0 ${r(qy - (H - m - W * 0.11))})">${q.svg}</g>`;
  }
  s += text("Leaves drawn from the recording,", { x: m, y: m + small, size: small, face: F.mono, fill: c.muted, tracking: 0.02 });
  s += text("root to tip.", { x: m, y: m + small * 2.4, size: small, face: F.mono, fill: c.muted, tracking: 0.02 });
  return s;
}

export const herbarium: DesignDefinition = {
  id: "herbarium",
  name: "Herbarium",
  direction: "Botanical",
  tagline: "Your recording grown into a pressed botanical specimen — every leaf is a moment of sound.",
  rationale:
    "Answers the brief's test directly: remove the recording and it is still a legitimate botanical print. The waveform is encoded in the leaf lengths instead of drawn as bars, which no competitor does. Herbarium sheets and cyanotypes are long-established wall-art genres.",
  bestFor: ["Anniversary", "Mother's Day", "New baby", "Garden lovers"],
  fields: [
    { key: "title", label: "Title", placeholder: "Our first dance", maxLength: 40, required: true },
    { key: "subtitle", label: "Second line", placeholder: "“At Last”, Etta James", maxLength: 44 },
    { key: "names", label: "Collected by", placeholder: "Emma & James", maxLength: 30 },
    { key: "date", label: "Date", placeholder: "2025-06-14", maxLength: 24 },
    { key: "message", label: "A note on the label", placeholder: "Pressed from the song we danced to.", maxLength: 90, multiline: true },
  ],
  colorways: [
    cw("herbarium", "Herbarium", "#EFE9DC", "#2B3527", "#6F7462", "#2B3527", "#5F7153"),
    cw("blush", "Blush", "#F5EDE6", "#3F2D2A", "#86726C", "#3F2D2A", "#C3928A"),
    cw("cyanotype", "Cyanotype", "#1F3A5C", "#EEF1F0", "#A9B8C8", "#EEF1F0", "#E4EAEC"),
  ],
  sample: {
    title: "Our first dance",
    subtitle: "“At Last”, Etta James",
    names: "Emma & James",
    date: "2025-06-14",
    message: "Pressed from the song we danced to.",
  },
  sampleSeed: "herbarium-first-dance",
  sampleKind: "song",
  render,
};
