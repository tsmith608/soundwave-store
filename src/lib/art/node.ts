/**
 * Server-only helpers: font embedding and Chromium rendering of artwork to
 * PNG (previews, mockups) and vector PDF (print files).
 */
import fs from "fs";
import path from "path";
import { FONT_FILES, type FaceKey } from "./fonts";

let cachedCss: string | null = null;

/** @font-face rules with the woff2 files inlined, so a standalone SVG/PDF needs nothing else. */
export function embeddedFontCss(root = process.cwd()): string {
  if (cachedCss) return cachedCss;
  const rules: string[] = [];
  for (const [key, rel] of Object.entries(FONT_FILES) as [FaceKey, string][]) {
    const [family, weight, style] = key.split("|");
    const file = path.join(root, "node_modules", "@fontsource", rel);
    const b64 = fs.readFileSync(file).toString("base64");
    rules.push(
      `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`
    );
  }
  cachedCss = rules.join("");
  return cachedCss;
}

export const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find((p) =>
    fs.existsSync(p)
  );

type Browser = import("playwright-core").Browser;

export async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  return chromium.launch({ executablePath: CHROMIUM_PATH });
}

function htmlFor(svg: string, widthIn: number, heightIn: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:${widthIn}in ${heightIn}in;margin:0}
html,body{margin:0;padding:0;background:#fff}
svg{display:block;width:${widthIn}in;height:${heightIn}in}
</style></head><body>${svg}</body></html>`;
}

/** Vector PDF at exact physical size. Text stays as real type, shapes as vectors. */
export async function svgToPdf(browser: Browser, svg: string, widthIn: number, heightIn: number, out: string): Promise<void> {
  const page = await browser.newPage();
  await page.setContent(htmlFor(svg, widthIn, heightIn), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out, width: `${widthIn}in`, height: `${heightIn}in`, printBackground: true, pageRanges: "1" });
  await page.close();
}

/** PNG of arbitrary HTML (used for mockups) at a CSS pixel size and device scale. */
export async function htmlToPng(browser: Browser, html: string, width: number, height: number, out: string, scale = 1): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: out.endsWith(".jpg") ? "jpeg" : "png", quality: out.endsWith(".jpg") ? 88 : undefined });
  await page.close();
}

/** PNG raster of the artwork at `pxWidth` pixels wide. */
export async function svgToPng(browser: Browser, svg: string, widthIn: number, heightIn: number, pxWidth: number, out: string): Promise<void> {
  const h = Math.round((pxWidth * heightIn) / widthIn);
  const sized = svg.replace(/width="[\d.]+in" height="[\d.]+in"/, `width="${pxWidth}" height="${h}"`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style></head><body>${sized}</body></html>`;
  await htmlToPng(browser, html, pxWidth, h, out);
}
