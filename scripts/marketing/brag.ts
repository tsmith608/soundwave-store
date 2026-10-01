/**
 * Afterhum launch video (made with the /brag skill, brag-slim mode).
 *   npx tsx scripts/marketing/brag.ts --stills 1.5,6.9   # review stills only
 *   npx tsx scripts/marketing/brag.ts                     # all frames → marketing/brag-output/work/frames
 * Then scripts/marketing/brag_audio.py writes the soundtrack and ffmpeg muxes (see marketing/brag-output/README.md).
 *
 * Every frame is a pure function of time: CSS animations are paused and scrubbed,
 * and text/artwork changes are time-keyed swaps. Prints come from the real art engine.
 */
import "../_env";
import fs from "fs";
import path from "path";
import { launch } from "../../src/lib/art/node";
import { samplePeaks } from "../../src/lib/art";
import { C, art, doc, framed, logo, phone, pill } from "./kit";

const W = 1920;
const H = 1080;
const FPS = 30;
export const DURATION = 21.5;
const OUT = path.resolve("marketing/brag-output");
const WORK = path.join(OUT, "work");

type Swaps = Record<string, [number, string][]>;
const swaps: Swaps = {};
const swap = (id: string, t: number, html: string) => (swaps[id] ??= []).push([t, html]);

const css = `*{animation-play-state:paused!important;animation-fill-mode:both!important}
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
.pfill{animation:none}
rect.b{transform-box:fill-box;transform-origin:center}
.input{border:1px solid rgba(21,20,18,.25);border-radius:16px;height:72px;display:flex;align-items:center;padding:0 24px;font-size:30px;background:#fff}
`;

/** Scene wrapper: outer fades out at `end`, inner fades in at `start` (a dip through paper). */
const scene = (start: number, end: number, bg: string, body: string) =>
  `<div class="scene" style="animation:out .3s ${end - 0.3}s ease-in"><div class="scene" style="background:${bg};animation:in .35s ${start}s ease-out">${body}</div></div>`;

const demo = (color: string) => `<div class="meta" style="position:absolute;right:80px;top:64px;font-size:20px;color:${color};opacity:.55">Demo · illustrative names</div>`;

function waveBars(seed: string, n: number, w: number, h: number, color: string, t0: number): string {
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

const walter = (title: string) =>
  art({ design: "herbarium", colorway: "stone", fields: { title, subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" } });

function build(): string {
  // 1 · Hook — blush
  const s1 = scene(0, 3.4, C.romantic, `
    ${demo(C.wine)}
    <h1 class="display e" style="position:absolute;left:140px;top:290px;width:960px;font-size:160px;color:${C.wine};animation:up .7s .1s">Don&rsquo;t delete that <span class="accent">voicemail.</span></h1>
    <div class="e" style="position:absolute;left:1260px;top:150px;--r:-3deg;animation:pop .7s .2s">${phone({ w: 380, label: "", time: "0:14", scene: "voicemail", seed: "dadvm", progress: 1 })}</div>
    <style>.s1 .pfill{animation:fill 2.8s .5s linear!important}</style>`).replace('class="scene" style="background', 'class="scene s1" style="background');

  // 2 · Reveal — film: the sound grows into the print
  const s2 = scene(3.4, 7.6, C.film, `
    <h1 class="display e" style="position:absolute;left:140px;top:250px;width:900px;font-size:124px;color:${C.ink};animation:up .7s 3.65s">Turn a moment you can <span class="accent">hear</span> into art you can <span class="accent">keep.</span></h1>
    <div style="position:absolute;left:1120px;top:410px;animation:out .35s 4.7s"><div>${waveBars("dadvm", 34, 600, 260, C.ink, 3.75)}</div></div>
    <div class="e" style="position:absolute;left:1190px;top:250px;--r:1.5deg;animation:pop .6s 5.05s">${framed(`<div class="e" style="width:100%;height:100%;animation:grow 1.7s 5.2s cubic-bezier(.5,0,.3,1)">${walter("Walter James Brennan")}</div>`, 460, "white")}</div>`);

  // 3 · Product in use — the studio, paper
  const name = "Walter James Brennan";
  const t0 = 8.7;
  const step = 0.09;
  for (let i = 0; i <= name.length; i++) swap("typed", i === 0 ? 0 : t0 + i * step, name.slice(0, i));
  swap("preview", 0, walter("Your words here"));
  swap("preview", t0 + 6 * step, walter("Walter"));
  swap("preview", t0 + 12 * step, walter("Walter James"));
  swap("preview", t0 + name.length * step, walter(name));
  const tabs = ["Memory", "Artwork", "Details", "Print", "Review"]
    .map((s, i) => `<div style="flex:1;border-radius:14px;padding:10px 16px;${i === 2 ? `background:${C.ink};color:${C.paper};box-shadow:0 10px 24px -14px rgba(21,20,18,.6)` : `color:${C.ink}`}"><div class="meta" style="font-size:13px;opacity:.7">0${i + 1}</div><div class="ui" style="font-size:19px;font-weight:600">${s}</div></div>`)
    .join("");
  const s3 = scene(7.6, 13.0, C.paper, `
    ${demo(C.ink)}
    <h1 class="display e" style="position:absolute;left:140px;top:96px;font-size:112px;color:${C.ink};animation:up .7s 7.8s">Make it <span class="accent">yours.</span></h1>
    <p class="ui e" style="position:absolute;left:146px;top:226px;font-size:34px;color:${C.soft};animation:up .7s 8.0s">The preview is exactly what we print.</p>
    <div class="e" style="position:absolute;left:250px;top:330px;--r:-1deg;animation:pop .7s 8.1s">${framed(`<div id="preview" style="width:100%;height:100%"></div>`, 420, "white")}</div>
    <div class="e" style="position:absolute;left:860px;top:320px;width:920px;padding:36px 40px;background:#FBFAF7;border-radius:30px;box-shadow:0 2px 4px rgba(21,20,18,.06),0 40px 80px -40px rgba(21,20,18,.45);animation:pop .7s 8.25s">
      <div style="display:flex;gap:6px;background:${C.paper2};border-radius:20px;padding:6px">${tabs}</div>
      <div class="meta" style="font-size:16px;margin-top:34px;color:${C.soft}">Their name</div>
      <div class="input ui" style="margin-top:10px;border-color:${C.ink}"><span id="typed"></span><span style="display:inline-block;width:2px;height:36px;background:${C.ink};margin-left:3px;animation:blink 1s 0s infinite steps(1)"></span></div>
      <div class="meta" style="font-size:16px;margin-top:24px;color:${C.soft}">Subtitle</div>
      <div class="input ui" style="margin-top:10px;color:${C.soft}">Voicemail · 11 March 2021</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:34px">
        <div class="display" style="font-size:56px;color:${C.ink}">$99</div>
        <div style="position:relative">
          <div class="e" style="position:absolute;right:calc(100% + 18px);top:8px;white-space:nowrap;animation:up .35s 11.85s"><div class="ui" style="background:${C.botanical};color:${C.botanicalInk};border-radius:999px;padding:12px 22px;font-size:22px;font-weight:500">✓ Added to your cart</div></div>
          <div style="animation:press .25s 11.6s">${pill("Add to cart", 30, C.ink, C.paper)}</div>
        </div>
      </div>
    </div>
    <svg class="e" style="position:absolute;left:1480px;top:640px;--dx:130px;--dy:132px;animation:cursor .7s 10.85s cubic-bezier(.4,0,.2,1)" width="34" height="44" viewBox="0 0 17 22"><path d="M1 1v17l4.5-4 3 7 3-1.3-3-6.9H15z" fill="${C.ink}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);

  // 4 · The moon — night
  const start = Date.UTC(2019, 9, 1);
  const days = 12;
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    const last = i === days - 1;
    swap("moon", i === 0 ? 0 : 13.6 + i * 0.15, framed(art({ design: "night-of", seed: "metnight", fields: { names: "Sam & Alex", date: iso, title: "The night we met" } }), 460, "black"));
    swap("moondate", i === 0 ? 0 : 13.6 + i * 0.15, `<span style="color:${last ? C.moon : C.nightInk};opacity:${last ? 1 : 0.6}">${label}</span>`);
  }
  const s4 = scene(13.0, 16.8, C.night, `
    <h1 class="display e" style="position:absolute;left:140px;top:300px;width:880px;font-size:124px;color:${C.nightInk};animation:up .7s 13.2s">The moon, exactly as it was <span class="accent">that night.</span></h1>
    <p class="meta e" style="position:absolute;left:146px;top:640px;font-size:22px;color:${C.nightInk};opacity:.6;animation:up .7s 13.5s">The Night Of · real phase for your date</p>
    <div class="e" style="position:absolute;left:1220px;top:150px;animation:pop .7s 13.3s"><div id="moon"></div></div>
    <div id="moondate" class="meta e" style="position:absolute;left:1220px;width:460px;top:780px;text-align:center;font-size:30px;animation:in .5s 13.4s"></div>`);

  // 5a · Scan it — paper
  const s5a = scene(16.8, 19.1, C.paper, `
    <h1 class="display e" style="position:absolute;left:140px;top:330px;width:820px;font-size:132px;color:${C.ink};animation:up .7s 16.95s">Scan it. Hear it <span class="accent">again.</span></h1>
    <p class="ui e" style="position:absolute;left:146px;top:640px;width:700px;font-size:30px;line-height:1.4;color:${C.soft};animation:up .7s 17.2s">A quiet code on the print plays the recording from any phone.</p>
    <div class="e" style="position:absolute;left:1060px;top:250px;--r:-2deg;animation:pop .7s 17.0s">${framed(walter("Walter James Brennan"), 380, "white")}</div>
    <div class="e" style="position:absolute;left:1440px;top:250px;animation:slideUp .8s 17.25s">${phone({ w: 330, label: "Walter", time: "", scene: "player", seed: "dadvm", progress: 1, caption: "Voicemail · 0:14" })}</div>
    <style>.s5 .pfill{animation:fill 1.6s 17.6s linear!important}</style>`).replace('class="scene" style="background', 'class="scene s5" style="background');

  // 5b · End card
  const s5b = scene(19.2, DURATION + 1, C.paper, `
    <div style="position:absolute;left:0;right:0;top:330px;display:flex;flex-direction:column;align-items:center;text-align:center">
      <div class="e" style="animation:up .7s 19.3s">${logo(92, C.ink)}</div>
      <p class="accent e" style="font-size:72px;color:${C.ink};margin-top:40px;animation:up .7s 19.6s">What stays after the sound.</p>
      <div class="e" style="margin-top:56px;animation:up .7s 19.95s">${pill("Make yours", 34, C.ink, C.paper)}</div>
    </div>`);

  return doc(W, H, s1 + s2 + s3 + s4 + s5a + s5b, C.paper, css);
}

async function main() {
  const args = process.argv.slice(2);
  const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;
  const html = build();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
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
  }, swaps);
  const seek = (t: number) => page.evaluate((x) => (window as unknown as { __seek: (t: number) => void }).__seek(x), t);

  if (stillsArg) {
    const dir = path.join(WORK, "stills");
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stillsArg.split(",").map(Number)) {
      await seek(t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.jpg`), type: "jpeg", quality: 80 });
    }
    console.log("stills", dir);
  } else {
    const dir = path.join(WORK, "frames");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const total = Math.round(DURATION * FPS);
    for (let f = 0; f < total; f++) {
      await seek(f / FPS);
      await page.screenshot({ path: path.join(dir, `${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 93 });
    }
    console.log("frames", total, dir);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
