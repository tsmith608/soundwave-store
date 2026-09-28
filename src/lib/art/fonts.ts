import metrics from "./fontMetrics.json";

/**
 * Typefaces used by the artwork. All are SIL OFL licensed and self-hosted via
 * @fontsource so preview and print use byte-identical font files.
 */
export type FaceKey = keyof typeof metrics;

export interface Face {
  family: string;
  weight: number;
  style: "normal" | "italic";
  key: FaceKey;
}

function face(family: string, weight: number, style: "normal" | "italic" = "normal"): Face {
  return { family, weight, style, key: `${family}|${weight}|${style}` as FaceKey };
}

export const F = {
  display: face("Instrument Serif", 400),
  displayItalic: face("Instrument Serif", 400, "italic"),
  garamond: face("Cormorant Garamond", 400),
  garamondMedium: face("Cormorant Garamond", 500),
  garamondItalic: face("Cormorant Garamond", 400, "italic"),
  garamondMediumItalic: face("Cormorant Garamond", 500, "italic"),
  sans: face("Inter", 400),
  sansMedium: face("Inter", 500),
  sansSemi: face("Inter", 600),
  mono: face("IBM Plex Mono", 400),
  monoMedium: face("IBM Plex Mono", 500),
} as const;

/** Files backing each face, relative to node_modules/@fontsource. Used by the print renderer. */
export const FONT_FILES: Record<FaceKey, string> = {
  "Instrument Serif|400|normal": "instrument-serif/files/instrument-serif-latin-400-normal.woff2",
  "Instrument Serif|400|italic": "instrument-serif/files/instrument-serif-latin-400-italic.woff2",
  "Cormorant Garamond|400|normal": "cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2",
  "Cormorant Garamond|400|italic": "cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2",
  "Cormorant Garamond|500|normal": "cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2",
  "Cormorant Garamond|500|italic": "cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2",
  "Inter|400|normal": "inter/files/inter-latin-400-normal.woff2",
  "Inter|500|normal": "inter/files/inter-latin-500-normal.woff2",
  "Inter|600|normal": "inter/files/inter-latin-600-normal.woff2",
  "IBM Plex Mono|400|normal": "ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  "IBM Plex Mono|500|normal": "ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
};

type Metric = { ascender: number; descender: number; capHeight: number; xHeight: number; fallback: number; widths: Record<string, number> };
const M = metrics as unknown as Record<FaceKey, Metric>;

export function capHeight(f: Face, size: number): number {
  return (M[f.key].capHeight / 1000) * size;
}

export function xHeight(f: Face, size: number): number {
  return (M[f.key].xHeight / 1000) * size;
}

/** Advance width of `text` in canvas units. `tracking` is in em (e.g. 0.2). */
export function measure(text: string, f: Face, size: number, tracking = 0): number {
  const m = M[f.key];
  let units = 0;
  const chars = Array.from(text);
  for (const ch of chars) units += m.widths[ch] ?? m.fallback;
  const trackingTotal = chars.length > 1 ? tracking * size * (chars.length - 1) : 0;
  // 1.5% safety margin for kerning / rendering differences
  return (units / 1000) * size * 1.015 + trackingTotal;
}

/** Largest size (<= max, >= min) at which `text` fits on one line within maxWidth. */
export function fitSize(text: string, f: Face, maxWidth: number, max: number, min: number, tracking = 0): number {
  if (!text) return max;
  const atOne = measure(text, f, 1, tracking);
  const s = maxWidth / Math.max(atOne, 0.0001);
  return Math.max(min, Math.min(max, s));
}

/** Greedy word wrap. Words longer than the line are hard-broken. */
export function wrap(text: string, f: Face, size: number, maxWidth: number, tracking = 0): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, f, size, tracking) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (measure(word, f, size, tracking) <= maxWidth) {
      line = word;
    } else {
      // hard-break very long tokens
      let chunk = "";
      for (const ch of Array.from(word)) {
        if (measure(chunk + ch, f, size, tracking) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Finds the largest size where `text` wraps into at most maxLines lines.
 * Balances line lengths so short messages don't leave a lonely last word.
 */
export function fitWrap(
  text: string,
  f: Face,
  maxWidth: number,
  maxLines: number,
  max: number,
  min: number,
  tracking = 0
): { size: number; lines: string[] } {
  if (!text.trim()) return { size: max, lines: [] };
  for (let size = max; size >= min; size -= Math.max(0.5, max / 60)) {
    const lines = wrap(text, f, size, maxWidth, tracking);
    if (lines.length <= maxLines) return { size, lines: balance(text, f, size, maxWidth, lines.length, tracking) };
  }
  const lines = wrap(text, f, min, maxWidth, tracking);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncateToWidth(kept[maxLines - 1] + "…", f, min, maxWidth, tracking);
    return { size: min, lines: kept };
  }
  return { size: min, lines };
}

/** Re-wraps into `n` lines with a narrower measure so lines are similar length. */
function balance(text: string, f: Face, size: number, maxWidth: number, n: number, tracking: number): string[] {
  if (n <= 1) return wrap(text, f, size, maxWidth, tracking);
  let best = wrap(text, f, size, maxWidth, tracking);
  for (let w = maxWidth; w > maxWidth * 0.5; w -= maxWidth * 0.04) {
    const lines = wrap(text, f, size, w, tracking);
    if (lines.length > n) break;
    best = lines;
  }
  return best;
}

export function truncateToWidth(text: string, f: Face, size: number, maxWidth: number, tracking = 0): string {
  if (measure(text, f, size, tracking) <= maxWidth) return text;
  let t = text.replace(/…$/, "");
  while (t.length > 1 && measure(t + "…", f, size, tracking) > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
