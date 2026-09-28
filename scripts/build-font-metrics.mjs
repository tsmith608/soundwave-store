// Extracts per-character advance widths from the self-hosted @fontsource
// files so the artwork renderer can fit and wrap text identically in the
// browser preview and in the print PDF (both use these exact font files).
//
// Usage: node scripts/build-font-metrics.mjs
import fs from "fs";
import path from "path";
import opentype from "opentype.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fs_ = (pkg, file) => path.join(root, "node_modules", "@fontsource", pkg, "files", file);

// Keys are "<family>|<weight>|<style>" and must match FONT_FACES in src/lib/art/fonts.ts
const FACES = {
  "Instrument Serif|400|normal": fs_("instrument-serif", "instrument-serif-latin-400-normal.woff"),
  "Instrument Serif|400|italic": fs_("instrument-serif", "instrument-serif-latin-400-italic.woff"),
  "Cormorant Garamond|400|normal": fs_("cormorant-garamond", "cormorant-garamond-latin-400-normal.woff"),
  "Cormorant Garamond|400|italic": fs_("cormorant-garamond", "cormorant-garamond-latin-400-italic.woff"),
  "Cormorant Garamond|500|normal": fs_("cormorant-garamond", "cormorant-garamond-latin-500-normal.woff"),
  "Cormorant Garamond|500|italic": fs_("cormorant-garamond", "cormorant-garamond-latin-500-italic.woff"),
  "Inter|400|normal": fs_("inter", "inter-latin-400-normal.woff"),
  "Inter|500|normal": fs_("inter", "inter-latin-500-normal.woff"),
  "Inter|600|normal": fs_("inter", "inter-latin-600-normal.woff"),
  "IBM Plex Mono|400|normal": fs_("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff"),
  "IBM Plex Mono|500|normal": fs_("ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff"),
};

// Printable ASCII + Latin-1 supplement + common typographic punctuation
const chars = [];
for (let c = 32; c <= 126; c++) chars.push(String.fromCharCode(c));
for (let c = 160; c <= 255; c++) chars.push(String.fromCharCode(c));
chars.push(..."‘’“”–—…·•″′");

const out = {};
for (const [key, file] of Object.entries(FACES)) {
  const buf = fs.readFileSync(file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const upm = font.unitsPerEm;
  const widths = {};
  let sum = 0;
  let n = 0;
  for (const ch of chars) {
    const g = font.charToGlyph(ch);
    if (!g || g.index === 0) continue;
    const w = Math.round(((g.advanceWidth ?? 0) / upm) * 1000);
    widths[ch] = w;
    if (/[a-z]/.test(ch)) {
      sum += w;
      n++;
    }
  }
  out[key] = {
    ascender: Math.round((font.ascender / upm) * 1000),
    descender: Math.round((font.descender / upm) * 1000),
    capHeight: Math.round(((font.tables.os2?.sCapHeight || font.ascender * 0.7) / upm) * 1000),
    xHeight: Math.round(((font.tables.os2?.sxHeight || font.ascender * 0.5) / upm) * 1000),
    fallback: Math.round(sum / Math.max(1, n)),
    widths,
  };
}

const dest = path.join(root, "src", "lib", "art", "fontMetrics.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} faces to ${path.relative(root, dest)}`);
