import { Face, measure } from "./fonts";

export function esc(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const r = (n: number) => Math.round(n * 100) / 100;

export interface TextOpts {
  x: number;
  y: number;
  size: number;
  face: Face;
  fill: string;
  anchor?: "start" | "middle" | "end";
  /** tracking in em */
  tracking?: number;
  opacity?: number;
  upper?: boolean;
}

/**
 * Emits an SVG <text>. Trailing letter-spacing is compensated so centred and
 * right-aligned tracked text sits exactly where it is measured.
 */
export function text(content: string, o: TextOpts): string {
  if (!content) return "";
  const str = o.upper ? content.toUpperCase() : content;
  const tracking = o.tracking ?? 0;
  const ls = tracking * o.size;
  let x = o.x;
  const anchor = o.anchor ?? "start";
  if (ls && anchor === "middle") x += ls / 2;
  if (ls && anchor === "end") x += ls;
  const attrs = [
    `x="${r(x)}"`,
    `y="${r(o.y)}"`,
    `font-family="'${o.face.family}'"`,
    `font-size="${r(o.size)}"`,
    `font-weight="${o.face.weight}"`,
    o.face.style === "italic" ? `font-style="italic"` : "",
    anchor !== "start" ? `text-anchor="${anchor}"` : "",
    ls ? `letter-spacing="${r(ls)}"` : "",
    `fill="${o.fill}"`,
    o.opacity !== undefined && o.opacity < 1 ? `opacity="${o.opacity}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<text ${attrs}>${esc(str)}</text>`;
}

/** Multiple lines with a fixed leading (baseline-to-baseline). */
export function lines(content: string[], o: TextOpts & { leading: number }): string {
  return content.map((l, i) => text(l, { ...o, y: o.y + i * o.leading })).join("");
}

export function width(content: string, face: Face, size: number, tracking = 0, upper = false): number {
  return measure(upper ? content.toUpperCase() : content, face, size, tracking);
}

export function line(x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = ""): string {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${r(w)}" ${extra}/>`;
}

export function rect(x: number, y: number, w: number, h: number, fill: string, extra = ""): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" ${extra}/>`;
}

export function circle(cx: number, cy: number, rad: number, fill: string, extra = ""): string {
  return `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" fill="${fill}" ${extra}/>`;
}

export function doc(W: number, H: number, widthIn: number, heightIn: number, body: string, defs = "", style = ""): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${W} ${r(H)}" width="${widthIn}in" height="${heightIn}in" preserveAspectRatio="xMidYMid meet">` +
    (style ? `<style>${style}</style>` : "") +
    (defs ? `<defs>${defs}</defs>` : "") +
    body +
    `</svg>`
  );
}
