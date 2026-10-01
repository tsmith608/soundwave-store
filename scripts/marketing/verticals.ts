/**
 * One vertical (1080×1920) video per product, made in the /brag style.
 *   npx tsx scripts/marketing/verticals.ts night-of --stills 1.5,6.5
 *   npx tsx scripts/marketing/verticals.ts herbarium            # frames → marketing/out/video/work-herbarium/frames
 *   npx tsx scripts/marketing/verticals.ts night-of --encode    # soundtrack + mp4 + poster (after frames)
 * Text stays between y≈230 and y≈1500 so Reels/TikTok UI never covers it.
 */
import "../_env";
import { execFileSync } from "child_process";
import path from "path";
import { C, art, doc, framed, logo, phone, pill } from "./kit";
import { demoLabel, encodeFilm, motionCss, renderFilm, scene, swapper, waveBars } from "./motion";

const W = 1080;
const H = 1920;
const DURATION = 20;
const OUT = path.resolve("marketing/out/video");

const headline = (text: string, at: number, color: string, size = 120, top = 250) =>
  `<h1 class="display e" style="position:absolute;left:84px;right:84px;top:${top}px;font-size:${size}px;color:${color};animation:up .7s ${at}s">${text}</h1>`;

const endCard = (start: number, bg: string, ink: string, product: string, fill: string, text: string) =>
  scene(start, DURATION + 1, bg, `
    <div style="position:absolute;left:0;right:0;top:620px;display:flex;flex-direction:column;align-items:center;text-align:center">
      <div class="e" style="animation:up .7s ${start + 0.1}s">${logo(64, ink)}</div>
      <div class="display e" style="font-size:132px;color:${ink};margin-top:60px;animation:up .7s ${start + 0.3}s">${product}</div>
      <p class="accent e" style="font-size:64px;color:${ink};margin-top:28px;animation:up .7s ${start + 0.55}s">What stays after the sound.</p>
      <div class="e" style="margin-top:64px;animation:up .7s ${start + 0.85}s">${pill("Make yours", 40, fill, text)}</div>
      <p class="meta e" style="font-size:24px;color:${ink};opacity:.65;margin-top:40px;animation:up .7s ${start + 1.05}s">Prints from $35 · framed from $69</p>
    </div>`);

function nightOf() {
  const { swaps, swap } = swapper();
  const moon = (date: string, colorway?: string) => art({ design: "night-of", colorway, seed: "metnight", fields: { names: "Sam & Alex", date, title: "The night we met" } });

  const s1 = scene(0, 3.4, C.night, `
    ${demoLabel(C.nightInk, 84, 170)}
    ${headline(`What did the moon look like the night you <span class="accent">met?</span>`, 0.1, C.nightInk, 116)}
    <div class="e" style="position:absolute;left:375px;top:800px;--r:-3deg;animation:pop .7s .25s">${phone({ w: 330, label: "IMG_0412.MOV", time: "00:19", scene: "night", seed: "metnight", progress: 1, caption: "the night we met" })}</div>
    <style>.n1 .pfill{animation:fill 2.8s .5s linear!important}</style>`, "n1");

  const start = Date.UTC(2019, 8, 28);
  const steps = 15; // 28 Sep → 12 Oct 2019
  for (let i = 0; i < steps; i++) {
    const d = new Date(start + i * 86400000);
    const at = i === 0 ? 0 : 4.0 + i * 0.16;
    const last = i === steps - 1;
    swap("moon", at, framed(moon(d.toISOString().slice(0, 10)), 560, "black"));
    swap("date", at, `<span style="color:${last ? C.moon : C.nightInk};opacity:${last ? 1 : 0.6}">${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>`);
  }
  const s2 = scene(3.4, 8.2, C.night, `
    ${headline(`We draw the real moon for <span class="accent">your date.</span>`, 3.6, C.nightInk, 116)}
    <div class="e" style="position:absolute;left:260px;top:640px;animation:pop .7s 3.75s"><div id="moon"></div></div>
    <div id="date" class="meta e" style="position:absolute;left:0;right:0;top:1380px;text-align:center;font-size:40px;animation:in .5s 3.9s"></div>`);

  const s3 = scene(8.2, 12.6, C.paper, `
    ${headline(`Ringed by the sound of your <span class="accent">recording.</span>`, 8.4, C.ink, 112)}
    <div class="e" style="position:absolute;left:90px;top:640px;width:900px;height:760px;border-radius:28px;overflow:hidden;box-shadow:0 40px 80px -40px rgba(21,20,18,.5);animation:pop .7s 8.5s">
      <div class="e" style="width:900px;height:1200px;transform-origin:50% 28%;--z0:1;--z1:1.14;animation:zoom 4.2s 8.4s linear">${moon("2019-10-12", "dawn")}</div>
    </div>
    <p class="ui e" style="position:absolute;left:90px;right:90px;top:1440px;font-size:32px;line-height:1.4;color:${C.soft};animation:up .7s 9.0s">Every mark around the moon is a moment of what you upload: a voice note, your vows, a video.</p>`);

  const ways: [string, string, "black" | "natural" | "white"][] = [["midnight", "Midnight", "black"], ["dawn", "Dawn", "natural"], ["plum", "Plum Night", "white"]];
  const s4 = scene(12.6, 16.4, C.paper, `
    ${headline(`Three colorways. Framed or <span class="accent">print-only.</span>`, 12.75, C.ink, 104)}
    <div style="position:absolute;left:60px;right:60px;top:760px;display:flex;justify-content:space-between">
      ${ways.map(([id, name, frame], i) => `<div class="e" style="text-align:center;animation:pop .6s ${13.0 + i * 0.25}s">${framed(moon("2019-10-12", id), 300, frame)}<div class="meta" style="font-size:22px;margin-top:26px;color:${C.soft}">${name}</div></div>`).join("")}
    </div>`);

  const s5 = endCard(16.4, C.night, C.nightInk, "The Night Of", C.moon, C.night);
  return { html: doc(W, H, s1 + s2 + s3 + s4 + s5, C.paper, motionCss), swaps, poster: Math.round(7.4 * 30) };
}

function herbarium() {
  const { swaps, swap } = swapper();
  const plant = (title: string, colorway = "herbarium") =>
    art({ design: "herbarium", colorway, fields: { title, subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" } });

  const s1 = scene(0, 3.4, C.botanical, `
    ${demoLabel(C.botanicalInk, 84, 170)}
    ${headline(`This plant grew from a <span class="accent">voicemail.</span>`, 0.1, C.botanicalInk, 128)}
    <div class="e" style="position:absolute;left:375px;top:800px;--r:-3deg;animation:pop .7s .25s">${phone({ w: 330, label: "", time: "0:14", scene: "voicemail", seed: "dadvm", progress: 1 })}</div>
    <style>.h1 .pfill{animation:fill 2.8s .5s linear!important}</style>`, "h1");

  const s2 = scene(3.4, 8.4, C.botanical, `
    ${headline(`Every leaf is a second of their <span class="accent">voice.</span>`, 3.6, C.botanicalInk, 112)}
    <div style="position:absolute;left:140px;top:860px;animation:out .35s 4.75s"><div>${waveBars("dadvm", 30, 800, 300, C.botanicalInk, 3.75)}</div></div>
    <div class="e" style="position:absolute;left:260px;top:600px;--r:1.5deg;animation:pop .6s 5.1s">${framed(`<div class="e" style="width:100%;height:100%;animation:grow 1.7s 5.25s cubic-bezier(.5,0,.3,1)">${plant("Walter James Brennan")}</div>`, 560, "natural")}</div>
    <p class="meta e" style="position:absolute;left:0;right:0;top:1380px;text-align:center;font-size:26px;color:${C.botanicalInk};opacity:.7;animation:up .6s 7.0s">Root to tip · no presets · no two alike</p>`);

  const name = "Walter James Brennan";
  const t0 = 9.4;
  const step = 0.09;
  for (let i = 0; i <= name.length; i++) swap("typed", i === 0 ? 0 : t0 + i * step, name.slice(0, i));
  swap("preview", 0, plant("Your words here"));
  swap("preview", t0 + 6 * step, plant("Walter"));
  swap("preview", t0 + 12 * step, plant("Walter James"));
  swap("preview", t0 + name.length * step, plant(name));
  const tabs = ["Memory", "Artwork", "Details", "Print", "Review"]
    .map((s, i) => `<div style="flex:1;border-radius:14px;padding:10px 12px;${i === 2 ? `background:${C.ink};color:${C.paper}` : `color:${C.ink}`}"><div class="meta" style="font-size:12px;opacity:.7">0${i + 1}</div><div class="ui" style="font-size:18px;font-weight:600">${s}</div></div>`)
    .join("");
  const s3 = scene(8.4, 13.2, C.paper, `
    ${demoLabel(C.ink, 84, 170)}
    ${headline(`Add their name. The preview <span class="accent">is the print.</span>`, 8.55, C.ink, 100, 240)}
    <div class="e" style="position:absolute;left:330px;top:560px;--r:-1deg;animation:pop .7s 8.7s">${framed(`<div id="preview" style="width:100%;height:100%"></div>`, 420, "white")}</div>
    <div class="e" style="position:absolute;left:70px;right:70px;top:1130px;padding:30px 32px;background:#FBFAF7;border-radius:30px;box-shadow:0 2px 4px rgba(21,20,18,.06),0 40px 80px -40px rgba(21,20,18,.45);animation:pop .7s 8.85s">
      <div style="display:flex;gap:6px;background:${C.paper2};border-radius:20px;padding:6px">${tabs}</div>
      <div class="meta" style="font-size:15px;margin-top:24px;color:${C.soft}">Their name</div>
      <div class="input ui" style="margin-top:10px;border-color:${C.ink}"><span id="typed"></span><span style="display:inline-block;width:2px;height:36px;background:${C.ink};margin-left:3px;animation:blink 1s 0s infinite steps(1)"></span></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px">
        <div class="display" style="font-size:52px;color:${C.ink}">$99</div>
        <div style="position:relative">
          <div class="e" style="position:absolute;right:calc(100% + 16px);top:8px;white-space:nowrap;animation:up .35s 12.25s"><div class="ui" style="background:${C.botanical};color:${C.botanicalInk};border-radius:999px;padding:12px 20px;font-size:22px;font-weight:500">✓ Added to your cart</div></div>
          <div style="animation:press .25s 12.0s">${pill("Add to cart", 30, C.ink, C.paper)}</div>
        </div>
      </div>
    </div>
    <svg class="e" style="position:absolute;left:640px;top:1290px;--dx:180px;--dy:128px;animation:cursor .7s 11.35s cubic-bezier(.4,0,.2,1)" width="34" height="44" viewBox="0 0 17 22"><path d="M1 1v17l4.5-4 3 7 3-1.3-3-6.9H15z" fill="${C.ink}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);

  const ways: [string, string, "black" | "natural" | "white"][] = [["herbarium", "Herbarium", "natural"], ["blush", "Blush", "white"], ["cyanotype", "Cyanotype", "black"], ["stone", "Stone", "white"]];
  const s4 = scene(13.2, 16.6, C.paper, `
    ${headline(`For a voicemail, your vows, a first <span class="accent">laugh.</span>`, 13.35, C.ink, 100, 240)}
    <div style="position:absolute;left:150px;right:150px;top:600px;display:grid;grid-template-columns:1fr 1fr;row-gap:44px;justify-items:center">
      ${ways.map(([id, nm, frame], i) => `<div class="e" style="text-align:center;animation:pop .6s ${13.5 + i * 0.25}s">${framed(plant("Walter James Brennan", id), 290, frame)}<div class="meta" style="font-size:20px;margin-top:20px;color:${C.soft}">${nm}</div></div>`).join("")}
    </div>`);

  const s5 = endCard(16.6, C.botanical, C.botanicalInk, "Herbarium", C.botanicalInk, C.botanical);
  return { html: doc(W, H, s1 + s2 + s3 + s4 + s5, C.paper, motionCss), swaps, poster: Math.round(7.6 * 30) };
}

async function main() {
  const [name, ...args] = process.argv.slice(2);
  const make = name === "night-of" ? nightOf : name === "herbarium" ? herbarium : null;
  if (!make) throw new Error("usage: verticals.ts night-of|herbarium [--stills t,t] [--encode]");
  const film = make();
  const workDir = path.join(OUT, `work-${name}`);
  if (args.includes("--encode")) {
    const wav = path.join(workDir, "soundtrack.wav");
    execFileSync("python3", ["scripts/marketing/brag_audio.py", name, wav], { stdio: "inherit" });
    encodeFilm(workDir, film.poster, wav, path.join(OUT, `vertical-${name}.mp4`), path.join(OUT, `vertical-${name}-poster.jpg`));
    return;
  }
  const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : undefined;
  await renderFilm({ html: film.html, swaps: film.swaps, width: W, height: H, duration: DURATION, workDir }, stills);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
