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

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  // Official Playwright images put browsers under PLAYWRIGHT_BROWSERS_PATH (/ms-playwright).
  for (const root of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/ms-playwright", "/opt/pw-browsers"].filter(Boolean) as string[]) {
    try {
      for (const d of fs.readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
        for (const sub of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
          const p = path.join(root, d, sub);
          if (fs.existsSync(p)) return p;
        }
      }
    } catch {
      /* not present */
    }
  }
  return ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
}

export const CHROMIUM_PATH = findChromium();

type Browser = import("playwright-core").Browser;

export async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  if (!CHROMIUM_PATH) throw new Error("Chromium not found. Set CHROMIUM_PATH (see docs/deployment.md).");
  return chromium.launch({ executablePath: CHROMIUM_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
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

/**
 * Adds print bleed: the artwork keeps its exact trim size and the background
 * colour extends `bleedIn` beyond every edge, so the lab's trim never shows a
 * white sliver. With bleedIn = 0 the SVG is returned unchanged.
 */
export function withBleed(svg: string, widthIn: number, heightIn: number, bleedIn: number, background: string): { svg: string; widthIn: number; heightIn: number } {
  if (!bleedIn) return { svg, widthIn, heightIn };
  const W = widthIn + 2 * bleedIn;
  const H = heightIn + 2 * bleedIn;
  const inner = svg.replace(/^([\s\S]*?<svg\b[^>]*?)\swidth="[\d.]+in"\s+height="[\d.]+in"/, `$1 x="${bleedIn}" y="${bleedIn}" width="${widthIn}" height="${heightIn}"`);
  const out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}in" height="${H}in" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${inner.replace(/^<\?xml[^>]*>/, "")}</svg>`;
  return { svg: out, widthIn: W, heightIn: H };
}

/** Vector PDF bytes at exact physical size. */
export async function svgToPdfBuffer(browser: Browser, svg: string, widthIn: number, heightIn: number): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(htmlFor(svg, widthIn, heightIn), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ width: `${widthIn}in`, height: `${heightIn}in`, printBackground: true, pageRanges: "1" });
  } finally {
    await page.close();
  }
}

/** Raster bytes at `dpi` (print files use 300). Renders at 100 CSS px/in × device scale so memory stays bounded. */
export async function svgToPngBuffer(browser: Browser, svg: string, widthIn: number, heightIn: number, dpi: number): Promise<{ png: Buffer; widthPx: number; heightPx: number }> {
  const cssW = Math.round(widthIn * 100);
  const cssH = Math.round(heightIn * 100);
  const scale = dpi / 100;
  const sized = svg.replace(/(<svg\b[^>]*?)\swidth="[\d.]+in"\s+height="[\d.]+in"/, `$1 width="${cssW}" height="${cssH}"`);
  const page = await browser.newPage({ viewport: { width: cssW, height: cssH }, deviceScaleFactor: scale });
  try {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block}</style></head><body>${sized}</body></html>`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: cssW, height: cssH } });
    return { png, widthPx: Math.round(cssW * scale), heightPx: Math.round(cssH * scale) };
  } finally {
    await page.close();
  }
}
