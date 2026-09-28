import { formatDate } from "../dates";
import { F, fitSize, fitWrap } from "../fonts";
import { esc, lines, r, text } from "../svg";
import type { DesignDefinition, RenderContext } from "../types";
import { bars } from "../waves";
import { background, cw, minType, qrBlock } from "./common";

function archPath(x: number, y: number, w: number, h: number): string {
  const rad = w / 2;
  return `M${r(x)} ${r(y + h)}V${r(y + rad)}A${r(rad)} ${r(rad)} 0 0 1 ${r(x + w)} ${r(y + rad)}V${r(y + h)}Z`;
}

/**
 * THE ARCH — Keepsake.
 * One large arched window of colour (or the couple's photo) with the
 * recording set inside it like a horizon. Names in a generous italic serif,
 * date in widely tracked capitals. Borrowed from contemporary wedding
 * stationery and the 2026 rounded-arch interior trend; no corner ornament.
 */
function render(ctx: RenderContext): string {
  const { W, H, fields, colorway: c, uid } = ctx;
  const small = minType(ctx);
  let s = background(ctx);

  const aw = W * 0.6;
  const ax = (W - aw) / 2;
  const ay = H * 0.085;
  const ah = H * 0.53;
  const d = archPath(ax, ay, aw, ah);
  const photo = ctx.opts.photoHref;

  s += `<defs><clipPath id="${uid}-arch"><path d="${d}"/></clipPath></defs>`;
  if (photo) {
    s += `<g clip-path="url(#${uid}-arch)"><rect x="${r(ax)}" y="${r(ay)}" width="${r(aw)}" height="${r(ah)}" fill="${c.tone}"/>`;
    s += `<image href="${esc(photo)}" x="${r(ax)}" y="${r(ay)}" width="${r(aw)}" height="${r(ah)}" preserveAspectRatio="xMidYMid slice"/></g>`;
    // thin keyline so light photos still read as an arch on light paper
    s += `<path d="${d}" fill="none" stroke="${c.ink}" stroke-opacity="0.18" stroke-width="${r(W * 0.0015)}"/>`;
  } else {
    s += `<path d="${d}" fill="${c.tone}"/>`;
    // recording sits in the arch like a horizon line
    s += `<g clip-path="url(#${uid}-arch)">`;
    s += bars(ctx.peaks, { x: ax + aw * 0.12, y: ay + ah * 0.68, w: aw * 0.76, h: ah * 0.26, count: 58, color: c.paper, gap: 0.52 });
    s += `</g>`;
  }

  // Names
  let y = ay + ah + H * 0.095;
  const names = fields.names || fields.title || "";
  if (names) {
    const nameFit = fitWrap(names, F.garamondItalic, W * 0.78, 2, W * 0.088, W * 0.05);
    s += lines(nameFit.lines, { x: W / 2, y, size: nameFit.size, face: F.garamondItalic, fill: c.ink, anchor: "middle", leading: nameFit.size * 1.02 });
    y += nameFit.size * 1.02 * (nameFit.lines.length - 1);
  }

  // Date — tracked capitals
  const date = formatDate(fields.date, "long");
  if (date) {
    y += W * 0.058;
    const ds = fitSize(date, F.sansMedium, W * 0.7, W * 0.0195, small, 0.34);
    s += text(date, { x: W / 2, y, size: ds, face: F.sansMedium, fill: c.muted, anchor: "middle", tracking: 0.34, upper: true });
  }

  // With a photo the recording moves below the arch as fine bars
  if (photo) {
    y += W * 0.05;
    s += bars(ctx.peaks, { x: W * 0.28, y, w: W * 0.44, h: W * 0.045, count: 72, color: c.accent, gap: 0.5 });
    y += W * 0.01;
  }

  // Song / title line
  const song = [fields.title && fields.names ? fields.title : "", fields.subtitle].filter(Boolean).join(" — ");
  if (song) {
    y += W * 0.052;
    const ss = fitSize(song, F.garamond, W * 0.72, W * 0.03, small * 1.1);
    s += text(song, { x: W / 2, y, size: ss, face: F.garamond, fill: c.ink, anchor: "middle" });
  }

  if (fields.message) {
    y += W * 0.045;
    const mf = fitWrap(fields.message, F.garamondItalic, W * 0.62, 2, W * 0.026, small * 1.1);
    s += lines(mf.lines, { x: W / 2, y, size: mf.size, face: F.garamondItalic, fill: c.muted, anchor: "middle", leading: mf.size * 1.25 });
    y += mf.size * 1.25 * (mf.lines.length - 1);
  }

  const q = qrBlock(ctx, { x: W / 2, y: 0, color: c.ink, label: "Scan to listen", labelColor: c.muted });
  if (q.svg) {
    const qy = Math.max(y + W * 0.05, H - H * 0.055 - q.height);
    s += `<g transform="translate(0 ${r(qy)})">${q.svg}</g>`;
  }
  return s;
}

export const arch: DesignDefinition = {
  id: "arch",
  name: "The Arch",
  direction: "Keepsake",
  tagline: "A single arched window holding your recording — or your photo — with your names set beneath.",
  rationale:
    "Rounded arches are one of the most-cited 2026 interior and stationery shapes; one confident shape plus fine typography reads as stationery-grade, not template-grade. Supports an optional photo without turning into a collage.",
  bestFor: ["Wedding vows", "Anniversary", "Engagement", "New home"],
  supportsPhoto: true,
  fields: [
    { key: "names", label: "Names", placeholder: "Emma & James", maxLength: 36, required: true },
    { key: "date", label: "Date", placeholder: "2025-06-14", maxLength: 24 },
    { key: "title", label: "What we're hearing", placeholder: "Our vows", maxLength: 40, hint: "A song title, “Our vows”, “The proposal”…" },
    { key: "subtitle", label: "Artist or place", placeholder: "Asheville, North Carolina", maxLength: 40 },
    { key: "message", label: "A short line", placeholder: "I choose you, every single day.", maxLength: 80, multiline: true },
  ],
  colorways: [
    cw("terracotta", "Terracotta", "#F4EEE6", "#2E2622", "#7F7067", "#2E2622", "#C49A82"),
    cw("sage", "Sage", "#F2F1EA", "#26302A", "#6E776F", "#26302A", "#9FAE98"),
    cw("dusk", "Dusk", "#EFEAE3", "#232A36", "#6C7280", "#232A36", "#2F3B52"),
  ],
  sample: {
    names: "Emma & James",
    date: "2025-06-14",
    title: "Our vows",
    subtitle: "Asheville, North Carolina",
    message: "I choose you, every single day.",
  },
  sampleSeed: "emma-james-vows",
  sampleKind: "voice",
  render,
};
