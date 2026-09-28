import { resample, smooth } from "./peaks";
import { r } from "./svg";

/**
 * Waveform drawing primitives. Every primitive is pure vector geometry so it
 * reproduces cleanly at any print size.
 */

/** Vertical bars centred on a baseline, rounded caps. */
export function bars(
  peaks: number[],
  o: { x: number; y: number; w: number; h: number; count: number; color: string; gap?: number; minH?: number; round?: boolean; align?: "center" | "bottom" }
): string {
  const p = resample(peaks, o.count);
  const pitch = o.w / o.count;
  const bw = pitch * (1 - (o.gap ?? 0.45));
  const minH = o.minH ?? bw;
  const cap = o.round === false ? "butt" : "round";
  const segs: string[] = [];
  for (let i = 0; i < o.count; i++) {
    const h = Math.max(minH, p[i] * o.h);
    const cx = o.x + pitch * (i + 0.5);
    // round caps extend the line by bw/2 at each end; shorten to keep exact height
    const inset = cap === "round" ? Math.min(bw / 2, h / 2 - 0.01) : 0;
    let y1: number;
    let y2: number;
    if (o.align === "bottom") {
      y1 = o.y - h + inset;
      y2 = o.y - inset;
    } else {
      y1 = o.y - h / 2 + inset;
      y2 = o.y + h / 2 - inset;
    }
    segs.push(`M${r(cx)} ${r(y1)}V${r(Math.max(y1 + 0.01, y2))}`);
  }
  return `<path d="${segs.join("")}" stroke="${o.color}" stroke-width="${r(bw)}" stroke-linecap="${cap}" fill="none"/>`;
}

/** Catmull-Rom → cubic Bézier through points. */
function smoothPath(pts: [number, number][], move = true): string {
  if (pts.length < 2) return "";
  let d = move ? `M${r(pts[0][0])} ${r(pts[0][1])}` : `L${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/** Smooth mirrored silhouette (filled envelope). */
export function envelope(
  peaks: number[],
  o: { x: number; y: number; w: number; h: number; count?: number; color: string; mirror?: boolean; opacity?: number; taper?: boolean }
): string {
  const n = o.count ?? 120;
  const p = smooth(resample(peaks, n), 1);
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const taper = o.taper === false ? 1 : Math.sin(Math.PI * t) ** 0.35;
    const a = p[i] * taper * (o.h / 2);
    const x = o.x + t * o.w;
    top.push([x, o.y - a]);
    bottom.push([x, o.y + (o.mirror === false ? 0 : a)]);
  }
  const d = smoothPath(top) + smoothPath(bottom.reverse(), false) + "Z";
  return `<path d="${d}" fill="${o.color}"${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

/**
 * A fine oscillating trace, like an oscilloscope or a hand-plotted recording.
 * Alternating samples above and below the baseline read as sound, not as bars.
 */
export function trace(
  peaks: number[],
  o: { x: number; y: number; w: number; h: number; count?: number; color: string; stroke: number; opacity?: number }
): string {
  const n = o.count ?? 360;
  const p = resample(peaks, n);
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const sign = i % 2 === 0 ? -1 : 1;
    const edge = Math.min(1, t * 30, (1 - t) * 30);
    pts.push(`${r(o.x + t * o.w)},${r(o.y + sign * p[i] * edge * (o.h / 2))}`);
  }
  return `<polyline points="${pts.join(" ")}" fill="none" stroke="${o.color}" stroke-width="${r(o.stroke)}" stroke-linejoin="round" stroke-linecap="round"${
    o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""
  }/>`;
}

/** Bars radiating from a circle. */
export function radial(
  peaks: number[],
  o: { cx: number; cy: number; r0: number; depth: number; count: number; color: string; stroke: number; startAngle?: number; sweep?: number; inward?: boolean }
): string {
  const p = resample(peaks, o.count);
  const start = o.startAngle ?? -Math.PI / 2;
  const sweep = o.sweep ?? Math.PI * 2;
  const segs: string[] = [];
  for (let i = 0; i < o.count; i++) {
    const a = start + (sweep * (i + 0.5)) / o.count;
    const len = Math.max(o.stroke, p[i] * o.depth);
    const rA = o.inward ? o.r0 - len : o.r0;
    const rB = o.inward ? o.r0 : o.r0 + len;
    segs.push(`M${r(o.cx + Math.cos(a) * rA)} ${r(o.cy + Math.sin(a) * rA)}L${r(o.cx + Math.cos(a) * rB)} ${r(o.cy + Math.sin(a) * rB)}`);
  }
  return `<path d="${segs.join("")}" stroke="${o.color}" stroke-width="${r(o.stroke)}" stroke-linecap="round" fill="none"/>`;
}

/** Dots along a circle whose radii follow amplitude. */
export function orbitDots(
  peaks: number[],
  o: { cx: number; cy: number; radius: number; count: number; minR: number; maxR: number; color: string; startAngle?: number }
): string {
  const p = resample(peaks, o.count);
  const start = o.startAngle ?? -Math.PI / 2;
  let out = "";
  for (let i = 0; i < o.count; i++) {
    const a = start + (Math.PI * 2 * i) / o.count;
    const rad = o.minR + p[i] * (o.maxR - o.minR);
    out += `<circle cx="${r(o.cx + Math.cos(a) * o.radius)}" cy="${r(o.cy + Math.sin(a) * o.radius)}" r="${r(rad)}"/>`;
  }
  return `<g fill="${o.color}">${out}</g>`;
}
