/**
 * Shared building blocks for marketing assets. Everything is rendered from the
 * real artwork engine, so ads show exactly what customers get.
 *
 * Brand name and domain come from env so the whole kit re-renders after a rename:
 *   MARKETING_BRAND="Still Heard" MARKETING_URL="stillheard.com" npm run marketing:render
 */
import fs from "fs";
import path from "path";
import { getDesign, renderArtwork, samplePeaks, type ArtFields } from "../../src/lib/art";
import { embeddedFontCss } from "../../src/lib/art/node";

export const BRAND = process.env.MARKETING_BRAND || process.env.NEXT_PUBLIC_BRAND_NAME || "Afterhum";
export const URL_TEXT = (process.env.MARKETING_URL || "yourdomain.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
export const SITE = `https://${URL_TEXT}`;
export const OUT = path.resolve(process.cwd(), "marketing/out");

export const C = {
  paper: "#F2EDE3",
  paper2: "#E9E2D4",
  ink: "#151412",
  soft: "#57524B",
  signal: "#FF5B2E",
  night: "#0F1627",
  nightInk: "#E8E6DF",
  moon: "#EFE6D0",
  botanical: "#DFE6CF",
  botanicalInk: "#213520",
  romantic: "#ECD3CD",
  wine: "#5A1E2B",
  film: "#F1D9A5",
};

function b64(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), "node_modules", rel)).toString("base64");
}

let cached: string | null = null;
/** Artwork fonts + brand display face (Bricolage) + UI faces, all inlined. */
export function fontsCss(): string {
  if (cached) return cached;
  const brand = [
    `@font-face{font-family:'Bricolage';src:url(data:font/woff2;base64,${b64("@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2")}) format('woff2');font-weight:200 800;font-display:block}`,
    `@font-face{font-family:'InterUI';src:url(data:font/woff2;base64,${b64("@fontsource/inter/files/inter-latin-500-normal.woff2")}) format('woff2');font-weight:500}`,
    `@font-face{font-family:'InterUI';src:url(data:font/woff2;base64,${b64("@fontsource/inter/files/inter-latin-600-normal.woff2")}) format('woff2');font-weight:600}`,
  ];
  cached = embeddedFontCss() + brand.join("");
  return cached;
}

export const baseCss = () => `${fontsCss()}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden;-webkit-font-smoothing:antialiased}
.display{font-family:'Bricolage';font-weight:800;font-variation-settings:'opsz' 96;letter-spacing:-0.045em;line-height:.86}
.accent{font-family:'Instrument Serif';font-style:italic;font-weight:400;letter-spacing:-0.01em}
.meta{font-family:'IBM Plex Mono';text-transform:uppercase;letter-spacing:.08em}
.ui{font-family:'InterUI',sans-serif}
.grain::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.10;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>")}
`;

let uid = 0;
export interface ArtOpts {
  design: "night-of" | "herbarium";
  colorway?: string;
  fields?: Partial<ArtFields>;
  kind?: "voice" | "heartbeat" | "song";
  seed?: string;
  widthIn?: number;
  heightIn?: number;
  qr?: boolean;
}

/** Real artwork SVG, sized to fill its container. */
export function art(o: ArtOpts): string {
  const d = getDesign(o.design)!;
  const fields = { ...d.sample, ...(o.fields ?? {}) } as ArtFields;
  return renderArtwork(d, fields, samplePeaks(o.seed ?? d.sampleSeed, o.kind ?? "voice"), {
    widthIn: o.widthIn ?? 12,
    heightIn: o.heightIn ?? 16,
    colorwayId: o.colorway,
    showQr: o.qr !== false,
    qrStyle: "discreet",
    qrUrl: `${SITE}/l/demo`,
    idPrefix: `k${uid++}`,
  }).replace(/width="[\d.]+in" height="[\d.]+in"/, 'width="100%" height="100%"');
}

const FRAMES: Record<string, [string, string]> = {
  black: ["#2A2826", "#0F0E0D"],
  natural: ["#D3B086", "#A8835A"],
  white: ["#F8F6F2", "#D6D1C8"],
};

/** A framed print with mount, glazing sheen and a soft wall shadow. */
export function framed(svg: string, widthPx: number, finish: keyof typeof FRAMES = "black", aspect = 16 / 12, shadow = true): string {
  const [a, b] = FRAMES[finish];
  const mould = widthPx * 0.045;
  const mount = widthPx * 0.085;
  const artW = widthPx - 2 * (mould + mount);
  return `<div style="width:${widthPx}px;padding:${mould}px;background:linear-gradient(135deg,${a},${b});${shadow ? `box-shadow:0 ${widthPx * 0.07}px ${widthPx * 0.1}px -${widthPx * 0.03}px rgba(30,20,10,.45),0 ${widthPx * 0.012}px ${widthPx * 0.02}px rgba(30,20,10,.22);` : ""}position:relative">
  <div style="padding:${mount}px;background:#FBFAF7;box-shadow:inset 0 2px 6px rgba(0,0,0,.25)">
    <div style="width:${artW}px;height:${artW * aspect}px;box-shadow:inset 0 1px 2px rgba(0,0,0,.2)">${svg}</div>
  </div>
  <div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.14),rgba(255,255,255,0) 40%,rgba(255,255,255,0) 72%,rgba(255,255,255,.05))"></div>
</div>`;
}

/** Deterministic waveform bars (the brand motif). */
export function bars(seed: string, n: number, w: number, h: number, color: string, gap = 0.35): string {
  const p = samplePeaks(seed, "voice");
  const bw = w / n;
  let out = "";
  for (let i = 0; i < n; i++) {
    const v = Math.max(0.08, p[Math.floor((i / n) * p.length)]);
    const bh = v * h;
    out += `<rect x="${(i * bw).toFixed(2)}" y="${((h - bh) / 2).toFixed(2)}" width="${(bw * (1 - gap)).toFixed(2)}" height="${bh.toFixed(2)}" rx="${(bw * 0.3).toFixed(2)}" fill="${color}"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

/** Stylised phone showing a camera-roll clip or voicemail (no real footage). */
export function phone(o: { w: number; label: string; time: string; scene: "dusk" | "garden" | "night" | "warm" | "voicemail" | "player"; seed?: string; progress?: number; caption?: string }): string {
  const h = o.w * 2.05;
  const scenes: Record<string, string> = {
    dusk: "linear-gradient(170deg,#3b4a7a,#c98a6a 60%,#f0c49a)",
    garden: "linear-gradient(170deg,#9fb38a,#5d7a4f 55%,#2f4429)",
    night: "linear-gradient(170deg,#0b1020,#1f2a4d 60%,#3a4a7a)",
    warm: "linear-gradient(170deg,#f3d6a4,#d99a6a 60%,#a2583f)",
    voicemail: "#F7F5F2",
    player: "linear-gradient(180deg,#1b1a19,#2a2724)",
  };
  const vm = o.scene === "voicemail";
  const fg = vm ? C.ink : "#fff";
  const progress = Math.max(0, Math.min(1, o.progress ?? 0.35));
  const inner = o.scene === "player"
    ? `<div style="position:absolute;inset:0;padding:${o.w * 0.1}px ${o.w * 0.08}px;color:#F2EDE3">
        <div class="meta" style="font-size:${o.w * 0.035}px;opacity:.6">Played from a print</div>
        <div class="accent" style="font-size:${o.w * 0.13}px;margin-top:${o.w * 0.25}px;line-height:1">${o.label}</div>
        <div class="ui" style="font-size:${o.w * 0.045}px;opacity:.7;margin-top:${o.w * 0.03}px">${o.caption ?? ""}</div>
        <div style="margin-top:${o.w * 0.12}px">${bars(o.seed ?? "player", 40, o.w * 0.84, o.w * 0.22, "#F2EDE3")}</div>
        <div style="height:3px;background:rgba(255,255,255,.25);margin-top:${o.w * 0.05}px"><div class="pfill" style="height:100%;width:${progress * 100}%;background:#FF5B2E"></div></div>
        <div style="display:flex;justify-content:center;margin-top:${o.w * 0.1}px"><div style="width:${o.w * 0.2}px;height:${o.w * 0.2}px;border-radius:50%;background:#F2EDE3;display:flex;align-items:center;justify-content:center"><div style="width:${o.w * 0.025}px;height:${o.w * 0.07}px;background:#151412;margin-right:${o.w * 0.02}px"></div><div style="width:${o.w * 0.025}px;height:${o.w * 0.07}px;background:#151412"></div></div></div>
      </div>`
    : vm
    ? `<div style="position:absolute;inset:0;padding:${o.w * 0.09}px ${o.w * 0.07}px">
        <div class="ui" style="font-size:${o.w * 0.06}px;font-weight:600;color:${C.ink}">Voicemail</div>
        <div style="margin-top:${o.w * 0.07}px;border-top:1px solid #ddd">
          ${["Dad", "Dentist", "Unknown"].map((n, i) => `<div class="ui" style="display:flex;justify-content:space-between;padding:${o.w * 0.04}px 0;border-bottom:1px solid #eee;font-size:${o.w * 0.045}px;color:${i ? "#888" : C.ink};font-weight:${i ? 500 : 600}"><span>${n}</span><span style="color:#999">${["Mar 11, 2021", "Yesterday", "Mon"][i]}</span></div>`).join("")}
        </div>
        <div style="margin-top:${o.w * 0.08}px">${bars(o.seed ?? "vm", 46, o.w * 0.86, o.w * 0.2, C.ink)}</div>
        <div style="height:3px;background:#ddd;margin-top:${o.w * 0.04}px;border-radius:2px"><div class="pfill" style="height:100%;width:${progress * 100}%;background:${C.ink};border-radius:2px"></div></div>
        <div class="meta" style="font-size:${o.w * 0.035}px;color:#777;margin-top:${o.w * 0.03}px;display:flex;justify-content:space-between"><span>0:0${Math.round(progress * 9)}</span><span>${o.time}</span></div>
      </div>`
    : `<div style="position:absolute;left:-20%;top:30%;width:60%;height:30%;border-radius:50%;background:rgba(255,255,255,.25);filter:blur(${o.w * 0.08}px)"></div>
       <div class="meta" style="position:absolute;top:${o.w * 0.07}px;left:${o.w * 0.07}px;right:${o.w * 0.07}px;display:flex;justify-content:space-between;color:${fg};font-size:${o.w * 0.04}px"><span><span style="display:inline-block;width:${o.w * 0.03}px;height:${o.w * 0.03}px;border-radius:50%;background:${C.signal};margin-right:${o.w * 0.02}px"></span>${o.label}</span><span>${o.time}</span></div>
       <div style="position:absolute;left:0;right:0;bottom:0;padding:${o.w * 0.25}px ${o.w * 0.07}px ${o.w * 0.08}px;background:linear-gradient(0deg,rgba(0,0,0,.65),rgba(0,0,0,0))">
         ${o.caption ? `<div class="accent" style="color:#fff;font-size:${o.w * 0.08}px;line-height:1.05;margin-bottom:${o.w * 0.04}px">${o.caption}</div>` : ""}
         ${bars(o.seed ?? "clip", 40, o.w * 0.86, o.w * 0.13, "rgba(255,255,255,.92)")}
         <div style="height:2px;background:rgba(255,255,255,.3);margin-top:${o.w * 0.03}px"><div class="pfill" style="height:100%;width:${progress * 100}%;background:#fff"></div></div>
       </div>`;
  return `<div style="width:${o.w}px;height:${h}px;border-radius:${o.w * 0.13}px;background:#111;padding:${o.w * 0.035}px;box-shadow:${o.w * 0.04}px ${o.w * 0.08}px ${o.w * 0.12}px rgba(0,0,0,.35)">
    <div style="position:relative;width:100%;height:100%;border-radius:${o.w * 0.1}px;overflow:hidden;background:${scenes[o.scene]}">${inner}</div></div>`;
}

export function doc(w: number, h: number, body: string, bg = C.paper, extraCss = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()}html,body{width:${w}px;height:${h}px;background:${bg}}.stage{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}${extraCss}</style></head><body><div class="stage grain">${body}</div></body></html>`;
}

/** Brand lock-up: bar mark + wordmark. */
export function logo(size: number, color: string): string {
  const marks = [5, 11, 7, 18, 10, 14, 6, 9].map((v, i) => `<rect x="${1 + i * 3.1}" y="${11 - v / 2}" width="2" height="${v}" rx="1" fill="${color}"/>`).join("");
  return `<div style="display:flex;align-items:center;gap:${size * 0.35}px;color:${color}"><svg width="${size * 1.2}" height="${size}" viewBox="0 0 26 22">${marks}</svg><span class="display" style="font-size:${size}px;letter-spacing:-.03em">${BRAND}</span></div>`;
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}
