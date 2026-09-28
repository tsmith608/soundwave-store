/**
 * Renders product mockups (framed artwork in simple interior scenes) for the
 * storefront from the real designs. Scenes are illustrative room settings;
 * the artwork in them is the actual renderer output.
 *
 *   npx tsx scripts/render-mockups.ts [outDir=public/mockups]
 */
import fs from "fs";
import path from "path";
import { DESIGNS, getDesign, renderArtwork, samplePeaks, type ArtFields } from "../src/lib/art";
import { embeddedFontCss, htmlToPng, launch } from "../src/lib/art/node";

const css = embeddedFontCss();

function art(designId: string, colorwayId?: string, fields?: ArtFields, kind?: "voice" | "song" | "heartbeat", w = 12, h = 16): string {
  const d = getDesign(designId)!;
  return renderArtwork(d, fields ?? d.sample, samplePeaks(d.sampleSeed, kind ?? d.sampleKind), {
    widthIn: w,
    heightIn: h,
    colorwayId,
    showQr: true,
    idPrefix: `m${Math.random().toString(36).slice(2, 7)}`,
  }).replace(/width="[\d.]+in" height="[\d.]+in"/, 'width="100%" height="100%"');
}

const FRAMES: Record<string, [string, string]> = {
  black: ["#23211F", "#0F0E0D"],
  natural: ["#CDAA7E", "#A8835A"],
  white: ["#F6F4F0", "#D9D4CC"],
};

function frame(svg: string, widthPx: number, finish = "black", aspect = 16 / 12): string {
  const [a, b] = FRAMES[finish];
  const mould = widthPx * 0.045;
  const mount = widthPx * 0.085;
  const artW = widthPx - 2 * (mould + mount);
  return `<div style="width:${widthPx}px;padding:${mould}px;background:linear-gradient(135deg,${a},${b});box-shadow:0 ${widthPx * 0.06}px ${widthPx * 0.09}px -${widthPx * 0.03}px rgba(40,28,16,.45),0 ${widthPx * 0.012}px ${widthPx * 0.02}px rgba(40,28,16,.2);position:relative">
  <div style="padding:${mount}px;background:#FBFAF7;box-shadow:inset 0 2px 6px rgba(0,0,0,.28)">
    <div style="width:${artW}px;height:${artW * aspect}px;box-shadow:inset 0 1px 2px rgba(0,0,0,.2)">${svg}</div>
  </div>
  <div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.12),rgba(255,255,255,0) 40%,rgba(255,255,255,0) 72%,rgba(255,255,255,.05))"></div>
</div>`;
}

function page(body: string, wall: string, w: number, h: number, extraCss = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
.wall{position:absolute;inset:0;background:${wall}}
.light{position:absolute;inset:0;background:linear-gradient(105deg,rgba(255,250,240,.35) 0%,rgba(255,250,240,0) 45%),radial-gradient(ellipse at 20% 0%,rgba(255,255,255,.25),rgba(0,0,0,0) 60%),linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(40,25,10,.08))}
${extraCss}</style></head><body><div class="wall"></div><div class="light"></div>${body}</body></html>`;
}

const vase = (x: number, y: number, s: number, color: string) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s * 1.3}px;background:radial-gradient(ellipse at 35% 30%,rgba(255,255,255,.35),rgba(255,255,255,0) 45%),${color};border-radius:45% 45% 38% 38% / 55% 55% 40% 40%;box-shadow:${s * 0.15}px ${s * 0.06}px ${s * 0.25}px rgba(40,25,10,.25)"></div>
   <div style="position:absolute;left:${x + s * 0.47}px;top:${y - s * 0.95}px;width:2px;height:${s}px;background:#6d6a4f;transform:rotate(-8deg);transform-origin:bottom"></div>
   <div style="position:absolute;left:${x + s * 0.2}px;top:${y - s * 1.1}px;width:${s * 0.35}px;height:${s * 0.18}px;background:#7d8261;border-radius:50%;transform:rotate(-30deg)"></div>
   <div style="position:absolute;left:${x + s * 0.55}px;top:${y - s * 0.8}px;width:${s * 0.32}px;height:${s * 0.16}px;background:#8a8f6c;border-radius:50%;transform:rotate(25deg)"></div>`;

const books = (x: number, y: number, s: number) =>
  `<div style="position:absolute;left:${x}px;top:${y - s * 0.36}px;width:${s * 1.3}px;height:${s * 0.12}px;background:#C9B79C;box-shadow:0 2px 4px rgba(0,0,0,.15)"></div>
   <div style="position:absolute;left:${x + s * 0.06}px;top:${y - s * 0.24}px;width:${s * 1.2}px;height:${s * 0.13}px;background:#3F4A45;box-shadow:0 2px 4px rgba(0,0,0,.15)"></div>
   <div style="position:absolute;left:${x - s * 0.04}px;top:${y - s * 0.11}px;width:${s * 1.35}px;height:${s * 0.11}px;background:#E4DDD1;box-shadow:0 2px 4px rgba(0,0,0,.15)"></div>`;

async function main() {
  const out = process.argv[2] ?? "public/mockups";
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();

  // 1. Hero: Herbarium leaning on a ledge, natural frame, warm wall
  {
    const W = 1600;
    const H = 1300;
    const body = `
      <div style="position:absolute;left:0;right:0;top:${H * 0.86}px;height:${H * 0.14}px;background:linear-gradient(180deg,#B89A78,#A4865F);box-shadow:0 -6px 18px rgba(60,40,20,.25)"></div>
      <div style="position:absolute;left:0;right:0;top:${H * 0.86}px;height:6px;background:#CFB18C"></div>
      <div style="position:absolute;left:${W * 0.3}px;top:${H * 0.86 - 872}px;transform:rotate(-1.5deg);transform-origin:bottom left">${frame(art("herbarium"), 700, "natural")}</div>
      ${vase(W * 0.72, H * 0.86 - 230, 160, "#D8CFC0")}
      ${books(W * 0.13, H * 0.86, 190)}`;
    await htmlToPng(browser, page(body, "#E9E2D7", W, H), W, H, path.join(out, "hero-herbarium.jpg"));
  }

  // 2. One wall scene per design, matched wall colours
  const walls: Record<string, string> = {
    "liner-notes": "#DCD6CC",
    arch: "#E8E0D6",
    herbarium: "#E4DED2",
    "night-of": "#D9D3CB",
    "in-memoriam": "#E2DDD5",
  };
  const finishes: Record<string, string> = { "liner-notes": "black", arch: "natural", herbarium: "natural", "night-of": "black", "in-memoriam": "white" };
  for (const d of DESIGNS) {
    const W = 1000;
    const H = 1200;
    const body = `
      <div style="position:absolute;left:0;right:0;top:${H * 0.9}px;bottom:0;background:#BFA98C"></div>
      <div style="position:absolute;left:${(W - 520) / 2}px;top:${H * 0.1}px">${frame(art(d.id), 520, finishes[d.id])}</div>`;
    await htmlToPng(browser, page(body, walls[d.id], W, H), W, H, path.join(out, `wall-${d.id}.jpg`));
  }

  // 3. Occasion examples with realistic words
  const examples: { file: string; design: string; colorway?: string; kind: "voice" | "song" | "heartbeat"; fields: ArtFields; finish: string; wall: string }[] = [
    {
      file: "example-first-dance.jpg",
      design: "liner-notes",
      colorway: "clay",
      kind: "song",
      finish: "natural",
      wall: "#E3DCD1",
      fields: { title: "Can't Help Falling in Love", subtitle: "Elvis Presley", names: "Priya & Daniel", date: "2024-09-21", message: "First dance, and every kitchen dance since." },
    },
    {
      file: "example-voicemail.jpg",
      design: "in-memoriam",
      colorway: "linen",
      kind: "voice",
      finish: "white",
      wall: "#DDD7CE",
      fields: { names: "Walter James Brennan", date: "1938 — 2025", subtitle: "Voicemail · 11 March 2021", message: "Hey kiddo, it's Dad. Nothing important. Just wanted to hear your voice.", title: "" },
    },
    {
      file: "example-night-we-met.jpg",
      design: "night-of",
      colorway: "midnight",
      kind: "voice",
      finish: "black",
      wall: "#E1DAD0",
      fields: { date: "2019-10-12", names: "Sam & Alex", title: "Our first phone call", message: "Five years of saying goodnight.", subtitle: "" },
    },
    {
      file: "example-heartbeat.jpg",
      design: "herbarium",
      colorway: "blush",
      kind: "heartbeat",
      finish: "white",
      wall: "#EAE3DA",
      fields: { title: "Hello, little one", subtitle: "Heartbeat at 20 weeks", names: "Mum & Dad", date: "2026-03-02", message: "Before we knew your name, we knew this sound." },
    },
    {
      file: "example-vows.jpg",
      design: "arch",
      colorway: "sage",
      kind: "voice",
      finish: "natural",
      wall: "#E6E1D8",
      fields: { names: "Maya & Theo", date: "2025-05-31", title: "Our vows", subtitle: "Big Sur, California", message: "Home is wherever you're standing." },
    },
    {
      file: "example-pet.jpg",
      design: "in-memoriam",
      colorway: "stone",
      kind: "voice",
      finish: "black",
      wall: "#DCD5CA",
      fields: { names: "Biscuit", date: "2011 — 2026", subtitle: "Recorded on the back porch", message: "The best boy. The loudest hello.", title: "" },
    },
  ];
  for (const ex of examples) {
    const W = 900;
    const H = 1100;
    const body = `
      <div style="position:absolute;left:0;right:0;top:${H * 0.9}px;bottom:0;background:#BEA88A"></div>
      <div style="position:absolute;left:${(W - 480) / 2}px;top:${H * 0.1}px">${frame(art(ex.design, ex.colorway, ex.fields, ex.kind), 480, ex.finish)}</div>`;
    await htmlToPng(browser, page(body, ex.wall, W, H), W, H, path.join(out, ex.file));
  }

  // 4. Trio for social / OG
  {
    const W = 1800;
    const H = 945;
    const trio = ["liner-notes", "herbarium", "night-of"]
      .map((id, i) => `<div style="position:absolute;left:${230 + i * 470}px;top:90px">${frame(art(id), 400, ["black", "natural", "black"][i])}</div>`)
      .join("");
    await htmlToPng(browser, page(trio, "#E4DDD2", W, H), W, H, path.join(out, "trio.jpg"));
    fs.copyFileSync(path.join(out, "trio.jpg"), path.join("public", "og.jpg"));
  }

  await browser.close();
  console.log("mockups written to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
