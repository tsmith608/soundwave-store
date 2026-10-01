/**
 * Silent 9:16 videos (1080×1920, 30 fps) for Reels / TikTok / Shorts.
 * Each video is one HTML page whose CSS animations are paused and scrubbed
 * frame by frame, so output is deterministic. Add trending/licensed audio
 * natively in the app when posting — the files are intentionally silent.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { C, OUT, URL_TEXT, art, doc, ensureDir, framed, logo, phone, pill } from "./kit";

type Browser = Awaited<ReturnType<typeof import("../../src/lib/art/node").launch>>;

const W = 1080;
const H = 1920;
const FPS = 30;

interface Video {
  name: string;
  seconds: number;
  html: string;
  /** Optional per-frame swaps: [startSecond, html] for the #swap element. */
  swaps?: [number, string][];
}

const anim = `*{animation-play-state:paused!important;animation-fill-mode:both!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeOut{from{opacity:1}to{opacity:0}}
@keyframes fill{from{width:0}to{width:100%}}
@keyframes grow{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes pop{0%{opacity:0;transform:scale(.85) rotate(var(--r,0deg))}100%{opacity:1;transform:scale(1) rotate(var(--r,0deg))}}
@keyframes shrinkAway{to{transform:translate(-250px,-160px) scale(.62) rotate(-8deg)}}
@keyframes slideUp{from{transform:translateY(1100px) rotate(-4deg)}to{transform:translateY(0) rotate(-4deg)}}
@keyframes scan{0%,100%{opacity:0}20%,80%{opacity:1}}
.a{animation-timing-function:cubic-bezier(.2,.7,.2,1)}`;

const endCard = (bg: string, ink: string, start: number) => `
<div class="a" style="position:absolute;inset:0;background:${bg};animation:fadeIn .6s ${start}s">
  <div style="position:absolute;left:90px;right:90px;top:640px">
    ${logo(54, ink)}
    <h2 class="display" style="font-size:150px;color:${ink};margin-top:70px">Keep the sound of <span class="accent">it.</span></h2>
    <div style="margin-top:80px">${pill("Make yours", 44, ink, bg)}</div>
    <div class="meta" style="font-size:36px;color:${ink};margin-top:48px;opacity:.8">${URL_TEXT}</div>
  </div>
</div>`;

const demo = (ink: string) => `<div class="meta" style="position:absolute;right:80px;top:150px;font-size:24px;color:${ink};opacity:.55">Demo · illustrative</div>`;

function voicemail(): Video {
  const grown = `<div class="grow a" style="width:100%;height:100%;animation:grow 3.2s 3.6s linear">${art({ design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025", message: "Hey kiddo, it's Dad. Just wanted to hear your voice." } })}</div>`;
  const body = `
  ${demo(C.wine)}
  <h1 class="display a" style="position:absolute;left:80px;right:80px;top:240px;font-size:150px;color:${C.wine};animation:fadeUp .8s .2s">Don&rsquo;t delete that <span class="accent">voicemail.</span></h1>
  <div class="a" style="position:absolute;left:310px;top:760px;animation:shrinkAway 1s 3s">
    <div style="transform:rotate(-3deg)">${phone({ w: 440, label: "", time: "0:14", scene: "voicemail", seed: "dadvm", progress: 1 })}</div>
  </div>
  <style>.pfill{animation:fill 2.6s .4s linear}</style>
  <div class="a" style="position:absolute;left:300px;top:760px;--r:2deg;animation:pop .8s 3.3s">${framed(grown, 560, "white")}</div>
  <p class="accent a" style="position:absolute;left:80px;right:80px;top:1560px;font-size:64px;color:${C.wine};animation:fadeUp .7s 6.8s">Every leaf is a moment of his voice.</p>
  ${endCard(C.romantic, C.wine, 9.4)}`;
  return { name: "video-01-voicemail-to-leaves", seconds: 12, html: doc(W, H, body, C.romantic, anim) };
}

function moon(): Video {
  const start = new Date(Date.UTC(2019, 8, 28));
  const swaps: [number, string][] = [];
  const steps = 15; // 28 Sep → 12 Oct 2019
  for (let i = 0; i < steps; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    const html = `<div style="position:absolute;left:250px;top:620px">${framed(art({ design: "night-of", seed: "metnight", fields: { names: "Sam & Alex", date: iso, title: "The night we met" } }), 580, "black")}</div>
      <div class="meta" style="position:absolute;left:0;right:0;top:1540px;text-align:center;font-size:48px;color:${i === steps - 1 ? C.moon : C.nightInk};opacity:${i === steps - 1 ? 1 : 0.7}">${label}</div>`;
    swaps.push([1.4 + i * 0.32, html]);
  }
  const body = `
  ${demo(C.nightInk)}
  <h1 class="display a" style="position:absolute;left:80px;right:80px;top:230px;font-size:128px;color:${C.nightInk};animation:fadeUp .8s .2s">What did the moon look like the night you <span class="accent">met?</span></h1>
  <div id="swap" class="a" style="animation:fadeIn .6s 1.2s"></div>
  <p class="accent a" style="position:absolute;left:80px;right:80px;top:1650px;font-size:60px;color:${C.nightInk};animation:fadeUp .7s 6.6s">The real moon from your date, ringed by your recording.</p>
  ${endCard(C.night, C.nightInk, 9.4)}`;
  return { name: "video-02-moon-on-your-date", seconds: 12, html: doc(W, H, body, C.night, anim), swaps };
}

function scanIt(): Video {
  const body = `
  ${demo(C.ink)}
  <h1 class="display a" style="position:absolute;left:80px;right:80px;top:240px;font-size:150px;color:${C.ink};animation:fadeUp .8s .2s">Scan it. Hear it <span class="accent">again.</span></h1>
  <div class="a" style="position:absolute;left:230px;top:640px;--r:-1deg;animation:pop .8s .6s">${framed(art({ design: "night-of", colorway: "dawn", fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows, from the wedding video" } }), 620, "natural")}</div>
  <div class="a" style="position:absolute;left:560px;top:1060px;animation:slideUp 1.1s 2.2s">
    <div style="position:relative">${phone({ w: 380, label: "", time: "", scene: "night", seed: "cam", progress: 0 })}
      <div class="a" style="position:absolute;left:90px;top:230px;width:200px;height:200px;border:6px solid #fff;border-radius:24px;animation:scan 1.2s 3.4s"></div>
      <div class="a" style="position:absolute;inset:0;animation:fadeIn .4s 4.6s">${phone({ w: 380, label: "Emma &amp; James", time: "", scene: "player", seed: "vows", progress: 1, caption: "Our vows · 0:42" })}</div>
    </div>
  </div>
  <style>.pfill{animation:fill 4s 5s linear}</style>
  <p class="accent a" style="position:absolute;left:80px;width:400px;top:1380px;font-size:56px;line-height:1.05;color:${C.ink};animation:fadeUp .7s 5.4s">The code on the print plays your recording.</p>
  ${endCard(C.paper, C.ink, 9.4)}`;
  return { name: "video-03-scan-it-hear-it", seconds: 12, html: doc(W, H, body, C.paper, anim) };
}

function ffmpegPath(): string {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}

export async function renderVideos(browser: Browser, filter?: string) {
  const dir = path.join(OUT, "video");
  ensureDir(dir);
  const ff = ffmpegPath();
  for (const v of [voicemail(), moon(), scanIt()].filter((x) => !filter || x.name.includes(filter))) {
    const frames = path.join(OUT, ".frames", v.name);
    fs.rmSync(frames, { recursive: true, force: true });
    ensureDir(frames);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(v.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    let current = -1;
    const total = Math.round(v.seconds * FPS);
    for (let f = 0; f < total; f++) {
      const t = f / FPS;
      if (v.swaps) {
        let idx = -1;
        v.swaps.forEach(([s], i) => { if (t >= s) idx = i; });
        if (idx < 0) idx = 0;
        if (idx !== current) {
          await page.evaluate((h) => { document.getElementById("swap")!.innerHTML = h; }, v.swaps[idx][1]);
          current = idx;
        }
      }
      await page.evaluate((ms) => { for (const a of document.getAnimations()) a.currentTime = ms; }, t * 1000);
      await page.screenshot({ path: path.join(frames, `${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    }
    await page.close();
    const out = path.join(dir, `${v.name}.mp4`);
    execFileSync(ff, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", out]);
    fs.copyFileSync(path.join(frames, `${String(Math.round(8 * FPS)).padStart(4, "0")}.jpg`), path.join(dir, `${v.name}-poster.jpg`));
    fs.rmSync(frames, { recursive: true, force: true });
    console.log("video", path.relative(process.cwd(), out));
  }
  fs.rmSync(path.join(OUT, ".frames"), { recursive: true, force: true });
}
