/**
 * Shared engine for the scripted marketing videos (launch film + per-product verticals).
 * Every frame is a pure function of time: CSS animations are paused and scrubbed,
 * and text/artwork changes are time-keyed swaps into elements by id.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { samplePeaks } from "../../src/lib/art";
import { launch } from "../../src/lib/art/node";
import { C } from "./kit";

export const FPS = 30;

export type Swaps = Record<string, [number, string][]>;
export function swapper() {
  const swaps: Swaps = {};
  const swap = (id: string, t: number, html: string) => (swaps[id] ??= []).push([t, html]);
  return { swaps, swap };
}

export const motionCss = `*{animation-play-state:paused!important;animation-fill-mode:both!important}
body{background:${C.paper}}
.scene{position:absolute;inset:0;overflow:hidden}
.e{animation-timing-function:cubic-bezier(.2,.7,.2,1)}
@keyframes in{from{opacity:0}to{opacity:1}}
@keyframes out{from{opacity:1}to{opacity:0}}
@keyframes up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:translateY(30px) scale(.96) rotate(var(--r,0deg))}to{opacity:1;transform:rotate(var(--r,0deg))}}
@keyframes fill{from{width:0}to{width:100%}}
@keyframes grow{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes barIn{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes cursor{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
@keyframes press{0%,100%{transform:scale(1)}50%{transform:scale(.95)}}
@keyframes slideUp{from{opacity:0;transform:translateY(160px) rotate(-3deg)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes zoom{from{transform:scale(var(--z0,1))}to{transform:scale(var(--z1,1.15))}}
.pfill{animation:none}
rect.b{transform-box:fill-box;transform-origin:center}
.input{border:1px solid rgba(21,20,18,.25);border-radius:16px;height:72px;display:flex;align-items:center;padding:0 24px;font-size:30px;background:#fff}
`;

/** Scene wrapper: outer fades out at `end`, inner fades in at `start` (a dip through paper). */
export const scene = (start: number, end: number, bg: string, body: string, cls = "") =>
  `<div class="scene" style="animation:out .3s ${end - 0.3}s ease-in"><div class="scene ${cls}" style="background:${bg};animation:in .35s ${start}s ease-out">${body}</div></div>`;

export const demoLabel = (color: string, right = 80, top = 64) =>
  `<div class="meta" style="position:absolute;right:${right}px;top:${top}px;font-size:20px;color:${color};opacity:.55">Demo · illustrative names</div>`;

/** Waveform whose bars draw in one by one from `t0`. */
export function waveBars(seed: string, n: number, w: number, h: number, color: string, t0: number): string {
  const p = samplePeaks(seed, "voice");
  const bw = w / n;
  let out = "";
  for (let i = 0; i < n; i++) {
    const v = Math.max(0.1, p[Math.floor((i / n) * p.length)]);
    const bh = v * h;
    out += `<rect class="b e" style="animation:barIn .45s ${(t0 + i * 0.022).toFixed(3)}s" x="${(i * bw).toFixed(1)}" y="${((h - bh) / 2).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bw * 0.3).toFixed(1)}" fill="${color}"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

export interface Film {
  html: string;
  swaps: Swaps;
  width: number;
  height: number;
  duration: number;
  workDir: string;
}

/** Renders review stills (when `stills` is given) or every frame into workDir/frames. */
export async function renderFilm(film: Film, stills?: number[]) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: film.width, height: film.height }, deviceScaleFactor: 1 });
  await page.setContent(film.html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((s) => {
    const w = window as unknown as { __swaps: Swaps; __cur: Record<string, number>; __seek: (t: number) => void };
    w.__swaps = s;
    w.__cur = {};
    w.__seek = (t: number) => {
      for (const [id, list] of Object.entries(w.__swaps)) {
        let idx = 0;
        list.forEach(([st], i) => { if (t >= st) idx = i; });
        if (w.__cur[id] !== idx) {
          document.getElementById(id)!.innerHTML = list[idx][1];
          w.__cur[id] = idx;
        }
      }
      for (const a of document.getAnimations()) a.currentTime = t * 1000;
    };
  }, film.swaps);
  const seek = (t: number) => page.evaluate((x) => (window as unknown as { __seek: (t: number) => void }).__seek(x), t);

  if (stills) {
    const dir = path.join(film.workDir, "stills");
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stills) {
      await seek(t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 80 });
    }
    console.log("stills", dir);
  } else {
    const dir = path.join(film.workDir, "frames");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const total = Math.round(film.duration * FPS);
    for (let f = 0; f < total; f++) {
      await seek(f / FPS);
      await page.screenshot({ path: path.join(dir, `${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 93 });
    }
    console.log("frames", total, dir);
  }
  await browser.close();
}

export function ffmpegPath(): string {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}

/** Bakes the poster frame in as frame 0 (replacing it, so timing is unchanged) and muxes the soundtrack. */
export function encodeFilm(workDir: string, posterFrame: number, audio: string, outMp4: string, outPoster: string, crf = 18) {
  const frames = path.join(workDir, "frames");
  const pad = (n: number) => `${String(n).padStart(4, "0")}.jpg`;
  fs.copyFileSync(path.join(frames, pad(posterFrame)), outPoster);
  fs.copyFileSync(outPoster, path.join(frames, pad(0)));
  execFileSync(ffmpegPath(), [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%04d.jpg"), "-i", audio,
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outMp4,
  ]);
  console.log("video", path.relative(process.cwd(), outMp4));
}
