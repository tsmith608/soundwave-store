import { BRAND, C, URL_TEXT, art, bars, doc, framed, logo, phone, pill } from "./kit";

export interface Still {
  name: string;
  w: number;
  h: number;
  html: string;
}

const foot = (color: string, size = 28) =>
  `<div style="position:absolute;left:72px;right:72px;bottom:60px;display:flex;justify-content:space-between;align-items:center">${logo(size, color)}<span class="meta" style="font-size:${size * 0.75}px;color:${color};opacity:.75">${URL_TEXT}</span></div>`;

const demo = (color: string) => `<div class="meta" style="position:absolute;right:72px;top:64px;font-size:20px;color:${color};opacity:.55">Demo · illustrative names</div>`;

// ── Feed posts 1080×1350 ───────────────────────────────────────────────────
function heroPost(): Still {
  const body = `
  <div style="position:absolute;left:-140px;top:640px;width:900px;height:520px;background:${C.film};border-radius:46% 54% 40% 60%/50% 40% 60% 50%"></div>
  <div style="position:absolute;left:72px;top:80px;right:72px"><div class="meta" style="font-size:22px;color:${C.soft}">Source / your recording or video<br>Output / keepsake wall art</div>
  <h1 class="display" style="font-size:132px;color:${C.ink};margin-top:40px">Turn a moment you can <span class="accent" style="font-weight:400">hear</span> into art you can <span class="accent">keep.</span></h1></div>
  <div style="position:absolute;right:70px;bottom:150px;transform:rotate(2deg)">${framed(art({ design: "night-of", fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows, from the wedding video" } }), 470)}</div>
  <div style="position:absolute;left:96px;bottom:200px;transform:rotate(-6deg)">${phone({ w: 230, label: "IMG_4471.MOV", time: "00:21", scene: "dusk", seed: "vows", progress: 0.4 })}</div>
  ${foot(C.ink)}`;
  return { name: "feed-01-hero", w: 1080, h: 1350, html: doc(1080, 1350, body) };
}

function voicemailPost(): Still {
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px">
    <h1 class="display" style="font-size:150px;color:${C.wine}">Don&rsquo;t delete that <span class="accent">voicemail.</span></h1>
    <p class="ui" style="font-size:34px;line-height:1.35;color:${C.wine};margin-top:34px;max-width:780px;font-weight:500">Save it, upload it, and we&rsquo;ll grow it into a botanical print — every leaf drawn from their voice.</p>
  </div>
  <div style="position:absolute;left:90px;bottom:170px;transform:rotate(-4deg)">${phone({ w: 300, label: "", time: "0:14", scene: "voicemail", seed: "dadvm", progress: 0.55 })}</div>
  <div style="position:absolute;right:80px;bottom:150px;transform:rotate(2deg)">${framed(art({ design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025", message: "Hey kiddo, it's Dad. Just wanted to hear your voice." } }), 470, "white")}</div>
  ${demo(C.wine)}${foot(C.wine)}`;
  return { name: "feed-02-voicemail", w: 1080, h: 1350, html: doc(1080, 1350, body, C.romantic) };
}

function transformPost(): Still {
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px"><h1 class="display" style="font-size:118px;color:${C.ink}">From a clip on your phone to a print on your <span class="accent">wall.</span></h1></div>
  <div style="position:absolute;left:72px;right:72px;top:560px;display:flex;align-items:center;justify-content:space-between">
    <div style="text-align:center">${phone({ w: 250, label: "IMG_2208.MOV", time: "00:21", scene: "warm", seed: "dance", progress: 0.7, caption: "first dance, table six" })}<div class="meta" style="font-size:20px;margin-top:22px;color:${C.soft}">01 · your video</div></div>
    <div class="display" style="font-size:90px;color:${C.signal}">→</div>
    <div style="text-align:center"><div style="width:250px;height:250px;display:flex;align-items:center;justify-content:center;border:3px solid ${C.ink};background:${C.paper}">${bars("dance", 28, 210, 140, C.ink)}</div><div class="meta" style="font-size:20px;margin-top:22px;color:${C.soft}">02 · its sound</div></div>
    <div class="display" style="font-size:90px;color:${C.signal}">→</div>
    <div style="text-align:center">${framed(art({ design: "night-of", colorway: "dawn", fields: { names: "Maya & Jordan", date: "2024-09-12", title: "Our first dance, from table six" } }), 230, "natural")}<div class="meta" style="font-size:20px;margin-top:22px;color:${C.soft}">03 · your print</div></div>
  </div>
  <p class="accent" style="position:absolute;left:72px;bottom:150px;font-size:46px;color:${C.ink}">We use the sound, not the footage.</p>
  ${foot(C.ink)}`;
  return { name: "feed-03-transformation", w: 1080, h: 1350, html: doc(1080, 1350, body, C.film) };
}

function leavesPost(): Still {
  const body = `
  <div style="position:absolute;left:72px;top:110px;width:470px"><div class="meta" style="font-size:22px;color:${C.botanicalInk};opacity:.7">Collection 02 · Herbarium</div>
    <h1 class="display" style="font-size:104px;color:${C.botanicalInk};margin-top:28px">Every leaf is a moment of the <span class="accent">recording.</span></h1>
    <p class="ui" style="font-size:30px;line-height:1.4;color:${C.botanicalInk};margin-top:36px;font-weight:500">Its length is how loud that second was, root to tip. No two plants are alike — because no two voices are.</p></div>
  <div style="position:absolute;right:56px;top:150px;transform:rotate(2deg)">${framed(art({ design: "herbarium", fields: { title: "Our vows", subtitle: "Wedding video · June 14, 2025", names: "Emma & James" } }), 440, "natural")}</div>
  ${demo(C.botanicalInk)}${foot(C.botanicalInk)}`;
  return { name: "feed-04-herbarium", w: 1080, h: 1350, html: doc(1080, 1350, body, C.botanical) };
}

function moonPost(): Still {
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px"><div class="meta" style="font-size:22px;color:${C.nightInk};opacity:.7">Collection 01 · The Night Of</div>
    <h1 class="display" style="font-size:124px;color:${C.nightInk};margin-top:28px">The moon, exactly as it was <span class="accent">that night.</span></h1></div>
  <div style="position:absolute;left:50%;top:560px;transform:translateX(-50%)">${framed(art({ design: "night-of", fields: { names: "Sam & Alex", date: "2019-10-12", title: "The night we met", message: "" } }), 480, "black")}</div>
  <p class="ui" style="position:absolute;left:72px;right:72px;bottom:140px;font-size:28px;color:${C.nightInk};opacity:.85;font-weight:500;text-align:center">Phase computed for your date · ringed by the sound of your recording</p>
  ${demo(C.nightInk)}${foot(C.nightInk)}`;
  return { name: "feed-05-night-of", w: 1080, h: 1350, html: doc(1080, 1350, body, C.night) };
}

function qrPost(): Still {
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px"><h1 class="display" style="font-size:150px;color:${C.ink}">Scan it. <span class="accent">Hear it again.</span></h1>
  <p class="ui" style="font-size:32px;line-height:1.4;color:${C.soft};margin-top:30px;max-width:760px;font-weight:500">A small, tone-on-tone code on the print plays the original recording from any phone. No app.</p></div>
  <div style="position:absolute;left:110px;bottom:150px">${framed(art({ design: "herbarium", colorway: "blush", kind: "heartbeat", fields: { title: "Olive", subtitle: "20-week scan video", names: "Mom & Dad", date: "2026-03-14", message: "One hundred and fifty beats a minute." } }), 430, "white")}</div>
  <div style="position:absolute;right:110px;bottom:220px;transform:rotate(-8deg)">${phone({ w: 270, label: "Olive", caption: "20-week scan video", time: "0:06", scene: "player", seed: "heart", progress: 0.6 })}</div>
  <svg style="position:absolute;left:300px;bottom:330px" width="420" height="120"><path d="M10 100 C 140 10, 290 10, 400 60" stroke="${C.signal}" stroke-width="5" fill="none" stroke-dasharray="14 10"/></svg>
  ${demo(C.ink)}${foot(C.ink)}`;
  return { name: "feed-06-scan-it", w: 1080, h: 1350, html: doc(1080, 1350, body) };
}

function giftPost(): Still {
  const tiles = [
    ["For the anniversary", "night-of", { names: "Maya & Theo", date: "2025-05-31", title: "Our vows" }, "plum", "natural"],
    ["For the new parents", "herbarium", { title: "Ada's first laugh", subtitle: "Phone video · 4 months", names: "Ada Rose" }, "blush", "white"],
    ["For the one who misses a voice", "herbarium", { title: "Marcus Reid", subtitle: "Voice note · Summer 2023", names: "Always" }, "stone", "black"],
  ] as const;
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px"><h1 class="display" style="font-size:120px;color:${C.ink}">Gifts made from a sound you <span class="accent">share.</span></h1></div>
  <div style="position:absolute;left:44px;right:44px;top:470px;display:flex;justify-content:space-between">
    ${tiles.map(([label, d, f, cw, fin]) => `<div style="width:320px;text-align:center"><div style="display:flex;justify-content:center">${framed(art({ design: d, colorway: cw, fields: f, kind: label.includes("parents") ? "heartbeat" : "voice" }), 310, fin)}</div><div class="display" style="font-size:38px;color:${C.ink};margin-top:34px;line-height:1">${label}</div></div>`).join("")}
  </div>
  ${demo(C.ink)}${foot(C.ink)}`;
  return { name: "feed-07-gift-guide", w: 1080, h: 1350, html: doc(1080, 1350, body, C.paper2) };
}

// ── Carousel: how it works (3 slides, 1080×1350) ───────────────────────────
function howSlides(): Still[] {
  const steps = [
    ["Upload a memory", "A voice memo, a saved voicemail, a wedding clip, a baby's laugh. Videos work — only the sound is used.", phone({ w: 300, label: "IMG_0031.MOV", time: "00:09", scene: "garden", seed: "laugh", progress: 0.3, caption: "her first laugh" })],
    ["Make it yours", "Choose The Night Of or Herbarium, add names and a date. The preview is exactly what we print.", framed(art({ design: "herbarium", colorway: "blush", fields: { title: "Ada's first laugh", subtitle: "Phone video · 4 months", names: "Ada Rose", date: "2026-02-11" } }), 380, "white")],
    ["We print + frame it", "Archival fine-art paper, a real wood frame if you like, shipped free in the US with tracking.", framed(art({ design: "night-of", colorway: "midnight", fields: { names: "Ada Rose", date: "2026-02-11", title: "The night she first laughed" } }), 380, "natural")],
  ];
  return steps.map(([title, text, visual], i) => ({
    name: `carousel-how-${i + 1}`,
    w: 1080,
    h: 1350,
    html: doc(
      1080,
      1350,
      `<div class="display" style="position:absolute;left:72px;top:60px;font-size:260px;color:${C.signal}">${i + 1}</div>
       <div class="meta" style="position:absolute;right:72px;top:96px;font-size:22px;color:${C.soft}">How it works · ${i + 1}/3</div>
       <h2 class="display" style="position:absolute;left:72px;top:330px;right:72px;font-size:104px;color:${C.ink}">${title}</h2>
       <p class="ui" style="position:absolute;left:72px;top:470px;width:560px;font-size:32px;line-height:1.4;color:${C.soft};font-weight:500">${text}</p>
       <div style="position:absolute;right:90px;bottom:170px;transform:rotate(${i % 2 ? -2 : 2}deg)">${visual}</div>
       ${i === 2 ? `<div style="position:absolute;left:72px;top:640px">${pill("Make yours", 34, C.ink, C.paper)}<div class="meta" style="font-size:22px;color:${C.ink};margin-top:26px;opacity:.75">${URL_TEXT}</div></div>` : ""}
       ${foot(C.ink)}`,
      i === 1 ? C.paper2 : C.paper,
    ),
  }));
}

// ── Stories / TikTok covers 1080×1920 ──────────────────────────────────────
function stories(): Still[] {
  const s = (name: string, bg: string, color: string, headline: string, visual: string, sub: string): Still => ({
    name,
    w: 1080,
    h: 1920,
    html: doc(
      1080,
      1920,
      // Safe zones: platform UI covers ~250px at the top and ~400px at the bottom.
      `<h1 class="display" style="position:absolute;left:80px;right:80px;top:250px;font-size:120px;color:${color}">${headline}</h1>
       <div style="position:absolute;left:50%;top:700px;transform:translateX(-50%) rotate(-1.5deg)">${visual}</div>
       <p class="ui" style="position:absolute;left:80px;right:80px;top:1440px;text-align:center;font-size:38px;font-weight:600;color:${color}">${sub}</p>
       <div style="position:absolute;left:0;right:0;top:1520px;display:flex;justify-content:center">${logo(34, color)}</div>`,
      bg,
    ),
  });
  return [
    s("story-01-dads-voicemail", C.romantic, C.wine, `I turned my dad&rsquo;s old voicemail into <span class="accent">this.</span>`, framed(art({ design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" } }), 520, "white"), "Every leaf is a moment of his voice."),
    s("story-02-wedding-video", C.film, C.ink, `This is what our wedding video <span class="accent">sounds</span> like.`, framed(art({ design: "night-of", colorway: "dawn", fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows, from the wedding video" } }), 520, "natural"), "The moon from that night, ringed by our vows."),
    s("story-03-moon", C.night, C.nightInk, `What did the moon look like the night you <span class="accent">met?</span>`, framed(art({ design: "night-of", fields: { names: "Sam & Alex", date: "2019-10-12", title: "The night we met" } }), 520, "black"), "Tell us your date. We&rsquo;ll show you."),
    s("story-04-heartbeat", C.botanical, C.botanicalInk, `The first sound you heard of <span class="accent">them.</span>`, framed(art({ design: "herbarium", colorway: "blush", kind: "heartbeat", fields: { title: "Olive", subtitle: "20-week scan video", names: "Mom & Dad", date: "2026-03-14" } }), 520, "white"), "From the scan video in your camera roll."),
  ];
}

// ── Pinterest 1000×1500 ────────────────────────────────────────────────────
function pins(): Still[] {
  const p = (name: string, bg: string, color: string, kicker: string, title: string, visual: string): Still => ({
    name,
    w: 1000,
    h: 1500,
    html: doc(
      1000,
      1500,
      `<div style="position:absolute;left:0;right:0;top:110px;display:flex;justify-content:center">${visual}</div>
       <div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:${C.paper};border-top:4px solid ${C.ink};padding:56px 64px">
         <div class="meta" style="font-size:22px;color:${C.soft}">${kicker}</div>
         <h2 class="display" style="font-size:86px;color:${C.ink};margin-top:18px">${title}</h2>
         <div style="position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;align-items:center">${logo(28, C.ink)}<span class="meta" style="font-size:22px;color:${C.soft}">${URL_TEXT}</span></div>
       </div>`,
      bg,
    ),
  });
  return [
    p("pin-01-voicemail-memorial", C.romantic, C.wine, "Memorial gift idea", `Turn a saved voicemail into a <span class="accent">keepsake print</span>`, framed(art({ design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" } }), 520, "white")),
    p("pin-02-wedding-vows", C.botanical, C.botanicalInk, "Wedding keepsake", `Your vows, from the wedding video, as <span class="accent">wall art</span>`, framed(art({ design: "herbarium", fields: { title: "Our vows", subtitle: "Wedding video · June 14, 2025", names: "Emma & James" } }), 520, "natural")),
    p("pin-03-baby-heartbeat", C.film, C.ink, "Nursery art", `Baby&rsquo;s heartbeat from the <span class="accent">scan video</span>`, framed(art({ design: "herbarium", colorway: "blush", kind: "heartbeat", fields: { title: "Olive", subtitle: "20-week scan video", names: "Mom & Dad", date: "2026-03-14" } }), 520, "white")),
    p("pin-04-anniversary-moon", C.night, C.nightInk, "Anniversary gift", `The moon on the night you met — with <span class="accent">your voices</span>`, framed(art({ design: "night-of", colorway: "plum", fields: { names: "Maya & Theo", date: "2016-04-23", title: "Ten years" } }), 520, "black")),
  ];
}

// ── Square ads 1080×1080 ───────────────────────────────────────────────────
function ads(): Still[] {
  const a = (name: string, bg: string, color: string, headline: string, visual: string, cta: string, subline: string): Still => ({
    name,
    w: 1080,
    h: 1080,
    html: doc(
      1080,
      1080,
      `<h1 class="display" style="position:absolute;left:64px;top:70px;width:560px;font-size:96px;color:${color}">${headline}</h1>
       <p class="ui" style="position:absolute;left:64px;top:520px;width:500px;font-size:30px;line-height:1.4;font-weight:500;color:${color};opacity:.85">${subline}</p>
       <div style="position:absolute;right:56px;top:70px;transform:rotate(2deg)">${visual}</div>
       <div style="position:absolute;left:64px;bottom:150px">${pill(cta, 32, color, bg)}</div>
       <div style="position:absolute;left:64px;bottom:60px">${logo(28, color)}</div>`,
      bg,
    ),
  });
  return [
    a("ad-01-voice", C.romantic, C.wine, `Keep their voice where you can <span class="accent">see it.</span>`, framed(art({ design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 2021", names: "His children" } }), 400, "white"), "Make a keepsake", "Upload a saved voicemail or voice note. We grow it into a botanical print you can frame."),
    a("ad-02-video", C.film, C.ink, `Your wedding video, <span class="accent">framed.</span>`, framed(art({ design: "night-of", colorway: "dawn", fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows" } }), 400, "natural"), "Upload your clip", "Your vows or first dance, from the video on your phone. We use the sound, not the footage."),
    a("ad-03-moon", C.night, C.nightInk, `The moon from your <span class="accent">night.</span>`, framed(art({ design: "night-of", fields: { names: "Sam & Alex", date: "2019-10-12", title: "The night we met" } }), 400, "black"), "Find your moon", "The real moon on your date, ringed by the sound of your recording. Framed or print-only."),
  ];
}

// ── Seasonal: holiday order-by (1080×1350) ─────────────────────────────────
function holiday(): Still {
  const cutoff = process.env.MARKETING_CUTOFF || "Dec 10";
  const body = `
  <div style="position:absolute;left:72px;top:90px;right:72px"><div class="meta" style="font-size:22px;color:${C.nightInk};opacity:.75">For Christmas delivery (US)</div>
  <h1 class="display" style="font-size:150px;color:${C.nightInk};margin-top:26px">Order by <span style="color:${C.signal}">${cutoff}</span> <span class="accent">for framed prints.</span></h1></div>
  <div style="position:absolute;left:50%;bottom:150px;transform:translateX(-50%) rotate(-1deg)">${framed(art({ design: "night-of", colorway: "midnight", fields: { names: "Grandma & Grandpa", date: "1976-12-24", title: "Fifty Christmases" } }), 420, "natural")}</div>
  ${foot(C.nightInk)}`;
  return { name: "seasonal-holiday-cutoff", w: 1080, h: 1350, html: doc(1080, 1350, body, C.night) };
}

export function allStills(): Still[] {
  return [heroPost(), voicemailPost(), transformPost(), leavesPost(), moonPost(), qrPost(), giftPost(), ...howSlides(), ...stories(), ...pins(), ...ads(), holiday()];
}
export { BRAND };
