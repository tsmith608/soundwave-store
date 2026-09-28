import { F } from "../fonts";
import { qrPath } from "../qr";
import { rect, text } from "../svg";
import type { Colorway, RenderContext } from "../types";

export const upi = (ctx: RenderContext) => ctx.W / ctx.opts.widthIn;

/** QR size in canvas units: never smaller than `minIn` physical inches (scan reliability). */
export function qrSize(ctx: RenderContext, minIn = 0.9, share = 0.085): number {
  return Math.max(minIn * upi(ctx), ctx.W * share);
}

/** Smallest type allowed: 7pt on the printed piece, or `share` of width if larger. */
export function minType(ctx: RenderContext, share = 0.0135): number {
  return Math.max((7 / 72) * upi(ctx), ctx.W * share);
}

export function background(ctx: RenderContext, color?: string): string {
  return rect(0, 0, ctx.W, ctx.H, color ?? ctx.colorway.paper);
}

export function qrUrl(ctx: RenderContext): string {
  return ctx.opts.qrUrl || "https://soundwaveart.com/l/preview";
}

/**
 * QR code with a small caption. Returns markup and the block height.
 * `align` sets which edge x refers to.
 */
export function qrBlock(
  ctx: RenderContext,
  o: { x: number; y: number; color: string; label?: string; labelColor?: string; align?: "left" | "center" | "right"; minIn?: number }
): { svg: string; height: number; size: number } {
  if (!ctx.opts.showQr) return { svg: "", height: 0, size: 0 };
  const size = qrSize(ctx, o.minIn);
  const align = o.align ?? "center";
  const left = align === "center" ? o.x - size / 2 : align === "right" ? o.x - size : o.x;
  const labelSize = minType(ctx);
  // Phone cameras expect dark modules on a light ground. On dark colourways the
  // code sits on a small light tile (with quiet zone) instead of being inverted.
  const paper = ctx.colorway.paper;
  let svg: string;
  if (luminance(o.color) > luminance(paper)) {
    const pad = size * 0.14; // ≈4 modules of quiet zone for a version-3 code
    svg = `<rect x="${(left - pad).toFixed(2)}" y="${(o.y - pad).toFixed(2)}" width="${(size + pad * 2).toFixed(2)}" height="${(size + pad * 2).toFixed(2)}" rx="${(pad * 0.5).toFixed(2)}" fill="${o.color}"/>`;
    svg += qrPath(qrUrl(ctx), left, o.y, size, paper);
  } else {
    svg = qrPath(qrUrl(ctx), left, o.y, size, o.color);
  }
  let height = size;
  if (o.label) {
    svg += text(o.label, {
      x: o.x,
      y: o.y + size + labelSize * (luminance(o.color) > luminance(paper) ? 3.1 : 1.9),
      size: labelSize,
      face: F.sansMedium,
      fill: o.labelColor ?? o.color,
      anchor: align === "center" ? "middle" : align === "right" ? "end" : "start",
      tracking: 0.22,
      upper: true,
    });
    height += labelSize * 2.2;
  }
  return { svg, height, size };
}

export function cw(
  id: string,
  name: string,
  paper: string,
  ink: string,
  muted: string,
  accent: string,
  tone?: string
): Colorway {
  return { id, name, paper, ink, muted, accent, tone, swatch: [paper, tone ?? accent] };
}

/** Clamp helper for layout math. */
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Relative luminance of a #RRGGBB colour (0 black … 1 white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
