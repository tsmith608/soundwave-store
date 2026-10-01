/**
 * Exports clean print images (every colourway of both designs, 1500 px wide, 12×16 proportions)
 * to marketing/out/art/. Use them as ChatGPT reference images, or composite them into
 * AI-generated room scenes with scripts/marketing/composite.py so the print itself is never AI-drawn.
 *   npx tsx scripts/marketing/export_art.ts
 */
import "../_env";
import fs from "fs";
import path from "path";
import { getDesign, renderArtwork, samplePeaks, type ArtFields } from "../../src/lib/art";
import { launch, svgToPng } from "../../src/lib/art/node";
import { SITE } from "./kit";

const OUT = path.resolve("marketing/out/art");

const SAMPLES: Record<string, { fields: Partial<ArtFields>; seed: string; kind: "voice" | "heartbeat" }> = {
  "night-of": { fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows, from the wedding video" }, seed: "vows", kind: "voice" },
  herbarium: { fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" }, seed: "dadvm", kind: "voice" },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const [id, s] of Object.entries(SAMPLES)) {
    const d = getDesign(id)!;
    for (const cw of d.colorways) {
      const svg = renderArtwork(d, { ...d.sample, ...s.fields } as ArtFields, samplePeaks(s.seed, s.kind), {
        widthIn: 12, heightIn: 16, colorwayId: cw.id, showQr: true, qrStyle: "discreet", qrUrl: `${SITE}/l/demo`, idPrefix: `x-${cw.id}`,
      });
      const file = path.join(OUT, `${id}-${cw.id}.png`);
      await svgToPng(browser, svg, 12, 16, 1500, file);
      console.log("art", path.relative(process.cwd(), file));
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
