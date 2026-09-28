/**
 * Artwork rendering CLI.
 *
 *   npx tsx scripts/render-art.ts gallery [outDir]
 *       Renders every design (sellable + explorations) in every colourway with
 *       sample content, plus a contact sheet. Used for design review.
 *
 *   npx tsx scripts/render-art.ts print <spec.json> <out.pdf> [--png out.png]
 *       Renders a customer's artwork spec to a vector PDF at physical size.
 *       spec.json: { designId, colorwayId, fields, peaks, widthIn, heightIn, showQr, qrUrl, photoPath? }
 */
import fs from "fs";
import path from "path";
import { DESIGNS, EXPLORATION_DESIGNS, getDesign, renderArtwork, renderSample, sanitizePeaks } from "../src/lib/art";
import { embeddedFontCss, launch, svgToPdf, svgToPng } from "../src/lib/art/node";

async function gallery(outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const css = embeddedFontCss();
  const browser = await launch();
  const cards: string[] = [];
  for (const d of [...DESIGNS, ...EXPLORATION_DESIGNS]) {
    for (const [i, c] of d.colorways.entries()) {
      const svg = renderSample(d, { colorwayId: c.id, embedFontsCss: css, idPrefix: `g${i}` });
      const file = `${d.id}--${c.id}.png`;
      await svgToPng(browser, svg, 12, 16, i === 0 ? 900 : 600, path.join(outDir, file));
      if (i === 0) cards.push(`<figure><img src="${file}"><figcaption><b>${d.name}</b> · ${d.direction}</figcaption></figure>`);
      console.log("rendered", file);
    }
  }
  // 8x10 and 18x24 aspect checks for the sellable set
  for (const d of DESIGNS) {
    for (const [w, h] of [
      [8, 10],
      [18, 24],
    ]) {
      const svg = renderSample(d, { widthIn: w, heightIn: h, embedFontsCss: css });
      await svgToPng(browser, svg, w, h, 600, path.join(outDir, `${d.id}--${w}x${h}.png`));
    }
  }
  const sheet = `<!doctype html><html><head><style>
body{margin:0;padding:40px;background:#e7e2da;font:14px/1.3 sans-serif;color:#222}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
figure{margin:0}img{width:100%;display:block;box-shadow:0 10px 30px rgba(0,0,0,.18)}
figcaption{margin-top:10px}
</style></head><body><div class="g">${cards.join("")}</div></body></html>`;
  fs.writeFileSync(path.join(outDir, "contact-sheet.html"), sheet);
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  await page.goto("file://" + path.resolve(outDir, "contact-sheet.html"));
  await page.screenshot({ path: path.join(outDir, "contact-sheet.jpg"), fullPage: true, type: "jpeg", quality: 82 });
  await browser.close();
}

async function print(specPath: string, out: string, png?: string) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const design = getDesign(spec.designId);
  if (!design) throw new Error(`Unknown design ${spec.designId}`);
  const peaks = sanitizePeaks(spec.peaks);
  let photoHref: string | null = null;
  if (spec.photoPath && design.supportsPhoto) {
    const abs = path.resolve(spec.photoPath);
    const storage = path.resolve("storage") + path.sep;
    if (abs.startsWith(storage) && fs.existsSync(abs)) {
      const mime = abs.endsWith(".png") ? "image/png" : "image/jpeg";
      photoHref = `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
    }
  }
  const widthIn = Number(spec.widthIn);
  const heightIn = Number(spec.heightIn);
  const svg = renderArtwork(design, spec.fields, peaks, {
    widthIn,
    heightIn,
    colorwayId: spec.colorwayId,
    showQr: Boolean(spec.showQr),
    qrUrl: spec.qrUrl,
    photoHref,
    embedFontsCss: embeddedFontCss(),
  });
  const browser = await launch();
  await svgToPdf(browser, svg, widthIn, heightIn, out);
  if (png) await svgToPng(browser, svg, widthIn, heightIn, 1000, png);
  await browser.close();
  console.log(JSON.stringify({ ok: true, pdf: out, png: png ?? null, bytes: fs.statSync(out).size }));
}

const [mode, ...rest] = process.argv.slice(2);
(async () => {
  if (mode === "gallery") await gallery(rest[0] ?? "docs/review/designs");
  else if (mode === "print") {
    const pngIdx = rest.indexOf("--png");
    await print(rest[0], rest[1], pngIdx >= 0 ? rest[pngIdx + 1] : undefined);
  } else {
    console.error("usage: render-art.ts gallery [outDir] | print <spec.json> <out.pdf> [--png out.png]");
    process.exit(2);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
