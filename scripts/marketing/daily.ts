/**
 * Daily posts for TikTok, Facebook and Pinterest across the 8-week plan.
 *
 *   npx tsx scripts/marketing/daily.ts plan                 # writes marketing/social/daily.json + daily.csv
 *   npx tsx scripts/marketing/daily.ts pins                 # renders one Pinterest pin per day
 *   npx tsx scripts/marketing/daily.ts videos [from] [to]   # renders + encodes the generated TikToks (index range)
 *   npx tsx scripts/marketing/daily.ts still <index> <t,t>  # review stills of one generated video
 *
 * Days that already have a key post in social/calendar.json keep it; the rest get a
 * generated video from four series. Every print is drawn by the real art engine.
 */
import "../_env";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { formatDate, moonPhase, moonPhaseName, parseDate } from "../../src/lib/art/dates";
import { launch } from "../../src/lib/art/node";
import { C, art, doc, framed, logo, pill } from "./kit";
import { demoLabel, encodeFilm, motionCss, renderFilm, scene, swapper, waveBars } from "./motion";

const START = new Date(Date.UTC(2026, 9, 12)); // Mon 12 Oct 2026, same as social_calendar.py
const DAYS = 56;
const SITE = "https://DOMAIN";
const OUT = path.resolve("marketing/out/daily");
const W = 1080;
const H = 1920;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const utm = (source: string, content: string, pathName = "/create") => `${SITE}${pathName}?utm_source=${source}&utm_medium=social&utm_campaign=daily&utm_content=${content}`;

// ── Series content ──────────────────────────────────────────────────────────
const LISTS: { title: string; accent: string; items: string[]; tags: string }[] = [
  { title: "Sounds to record before they&rsquo;re", accent: "grown.", items: ["The first real laugh", "A made-up song", "How they say your name", "Bedtime questions", "\"I love you\" said slightly wrong"], tags: "#parenting #newparents #keepsake" },
  { title: "Questions to ask your grandparents, and", accent: "record.", items: ["How did you two meet?", "What was your first job?", "What did your house smell like?", "What song takes you back?", "What do you want us to remember?"], tags: "#grandparents #familystories #keepsake" },
  { title: "Voicemails worth", accent: "saving.", items: ["A happy-birthday song", "\"Call me back, love you\"", "\"Just checking in\"", "A message from a big day", "One from someone far away"], tags: "#voicemail #grief #keepsake" },
  { title: "Before you switch phones, save", accent: "these.", items: ["Saved voicemails", "Voice memos", "Videos with their voice", "WhatsApp voice notes", "Snapchat Memories"], tags: "#newphone #voicemail #techtips" },
  { title: "Sounds from your wedding day you can", accent: "keep.", items: ["Your vows", "The speeches", "The first dance", "The toast that made everyone cry", "The cheer when you walked in"], tags: "#wedding #weddingvows #bride" },
  { title: "How to record better audio on your", accent: "phone.", items: ["Get close: an arm's length or less", "Find the quietest room", "Turn on airplane mode", "Start recording a little early", "Keep the original file"], tags: "#phonetips #voicememo #howto" },
  { title: "The first anniversary is", accent: "paper.", items: ["A letter you write by hand", "Your vows, printed", "A map of where you met", "Tickets from your first date", "A print made from your wedding video"], tags: "#paperanniversary #anniversarygift #firstanniversary" },
  { title: "Things to record this", accent: "Thanksgiving.", items: ["The grace", "The story told every year", "The kids' table", "Grandpa's laugh", "\"How did you two meet?\""], tags: "#thanksgiving #familystories #holidays" },
  { title: "Ways to save a voicemail before it&rsquo;s", accent: "gone.", items: ["iPhone: Share → Save to Files", "Android: ⋮ → Share → Drive", "Carrier app: Save or Export", "Play on speaker, record it", "Ask for voicemail-to-email"], tags: "#voicemail #iphonetips #androidtips" },
  { title: "Baby sounds that change", accent: "fastest.", items: ["The newborn cry", "The first coos", "The first laugh", "Babbling conversations", "The first word"], tags: "#babyfirsts #newborn #newparents" },
  { title: "Don&rsquo;t wait to", accent: "record.", items: ["Your parents' voices", "Your grandparents' stories", "Your kids' small voices", "Your friends' best toast", "Your own voice, for them"], tags: "#keepsake #family #memories" },
  { title: "Long-distance love,", accent: "kept.", items: ["A voice note before bed", "The moon on the night you met", "Letters, actually posted", "The song you both play", "A date to count down to"], tags: "#longdistance #ldr #couplegoals" },
  { title: "Gifts that mean", accent: "something.", items: ["Their voice", "A date that matters", "A place you shared", "A story only you know", "A song from that night"], tags: "#meaningfulgifts #giftideas #christmasgifts" },
  { title: "Choosing between our two", accent: "designs.", items: ["A date that matters? The Night Of", "A voice to keep? Herbarium", "Both: framed or print-only", "8×10, 12×16 or 18×24 in", "Both can play the recording"], tags: "#wallart #giftguide #personalizedgifts" },
];

const GROW_HOOKS: { hook: string; colorway: string; frame: "black" | "natural" | "white"; title: string; subtitle: string }[] = [
  { hook: "This plant grew from a <span class=\"accent\">voicemail.</span>", colorway: "stone", frame: "white", title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021" },
  { hook: "Your recording, pressed like a <span class=\"accent\">flower.</span>", colorway: "herbarium", frame: "natural", title: "Our vows", subtitle: "Wedding video · June 14, 2025" },
  { hook: "The quiet moments grow the shortest <span class=\"accent\">leaves.</span>", colorway: "blush", frame: "white", title: "Olive", subtitle: "20-week scan video" },
  { hook: "No two of these are <span class=\"accent\">alike.</span>", colorway: "cyanotype", frame: "black", title: "Juniper", subtitle: "The bark at the door" },
  { hook: "A voice note, grown root to <span class=\"accent\">tip.</span>", colorway: "stone", frame: "natural", title: "Mom", subtitle: "Voice note · 2 May 2024" },
  { hook: "Every leaf is a second of their <span class=\"accent\">voice.</span>", colorway: "herbarium", frame: "white", title: "Grandpa Joe", subtitle: "Singing at Thanksgiving" },
  { hook: "What a wedding toast looks like as a <span class=\"accent\">plant.</span>", colorway: "blush", frame: "natural", title: "The best man's toast", subtitle: "Wedding video · 2025" },
  { hook: "We use the sound, not the <span class=\"accent\">footage.</span>", colorway: "cyanotype", frame: "white", title: "Our first dance", subtitle: "Phone video · table six" },
];

const PAIRS: [string, string, string, string][] = [
  ["night-of", "midnight", "night-of", "dawn"],
  ["herbarium", "herbarium", "herbarium", "cyanotype"],
  ["night-of", "plum", "night-of", "dawn"],
  ["herbarium", "blush", "herbarium", "stone"],
  ["night-of", "midnight", "herbarium", "herbarium"],
  ["night-of", "plum", "herbarium", "blush"],
  ["herbarium", "cyanotype", "night-of", "midnight"],
  ["herbarium", "stone", "night-of", "dawn"],
];
const CW_NAME: Record<string, string> = { midnight: "Midnight", dawn: "Dawn", plum: "Plum Night", herbarium: "Herbarium", blush: "Blush", cyanotype: "Cyanotype", stone: "Stone" };

const MOON_LINES = [
  "If tonight becomes a night you remember, this is its moon forever.",
  "Somewhere, someone is getting engaged under this one.",
  "Every date has its own moon. This is today's.",
  "Make a memory tonight, and this is the moon it keeps.",
];

// ── Plan ────────────────────────────────────────────────────────────────────
type Series = "moon" | "list" | "grow" | "pair";
interface DayPlan {
  index: number;
  date: string;
  day: string;
  week: number;
  tiktok: { kind: "anchor" | Series; asset: string; hook: string; caption: string; n?: number };
  facebook: { asset: string; caption: string };
  pinterest: { asset: string; title: string; description: string; link: string };
}

const WEEKDAY_SERIES: Series[] = ["moon", "list", "grow", "moon", "pair", "list", "moon"]; // Mon..Sun

interface Anchor { date: string; platforms: string[]; asset: string; hook: string; caption: string; format: string }
function anchors(): Anchor[] {
  return JSON.parse(fs.readFileSync("marketing/social/calendar.json", "utf8")).posts;
}

function moonFacts(dateIso: string) {
  const p = moonPhase(parseDate(dateIso)!);
  return { name: moonPhaseName(p), lit: Math.round(((1 - Math.cos(2 * Math.PI * p)) / 2) * 100) };
}

export function buildPlan(): DayPlan[] {
  const a = anchors();
  const counters: Record<Series, number> = { moon: 0, list: 0, grow: 0, pair: 0 };
  const plan: DayPlan[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(START.getTime() + i * 86400000);
    const date = iso(d);
    const week = Math.floor(i / 7) + 1;
    const reel = a.find((p) => p.date === date && p.platforms.includes("TikTok") && /\.mp4|best|^FILM/i.test(p.asset));
    let tiktok: DayPlan["tiktok"];
    if (reel) {
      tiktok = { kind: "anchor", asset: reel.asset.replace(/^out\//, "marketing/out/").replace(/^brag-output\//, "marketing/brag-output/"), hook: reel.hook, caption: reel.caption };
    } else {
      const kind = WEEKDAY_SERIES[i % 7];
      const n = counters[kind]++;
      const file = `marketing/out/daily/video/${date}-${kind}.mp4`;
      if (kind === "moon") {
        const f = moonFacts(date);
        tiktok = { kind, n, asset: file, hook: "This is the moon tonight.", caption: `The moon tonight, ${formatDate(date, "long")}: ${f.name.toLowerCase()}, about ${f.lit}% lit.\n\n${MOON_LINES[n % MOON_LINES.length]} The Night Of draws the real moon for any date, ringed by the sound of your recording.\n\n#moon #moonphase #thenightof #anniversarygift` };
      } else if (kind === "list") {
        const L = LISTS[n % LISTS.length];
        const t = `${L.title.replace(/&rsquo;/g, "'")} ${L.accent}`;
        tiktok = { kind, n, asset: file, hook: t, caption: `${t}\n\n${L.items.map((x, j) => `${j + 1}. ${x}`).join("\n")}\n\nSave this for later. ${L.tags}` };
      } else if (kind === "grow") {
        const G = GROW_HOOKS[n % GROW_HOOKS.length];
        const t = G.hook.replace(/<[^>]+>/g, "");
        tiktok = { kind, n, asset: file, hook: t, caption: `${t} Each leaf's length is how loud that moment of the recording was, root to tip. Upload a voicemail, a voice note or a video, and we grow yours.\n\n#herbarium #voicemail #keepsake #personalizedgifts` };
      } else {
        const P = PAIRS[n % PAIRS.length];
        tiktok = { kind, n, asset: file, hook: "Which would you hang?", caption: `Which would you hang: A (${CW_NAME[P[1]]}) or B (${CW_NAME[P[3]]})? Comment below.\n\nBoth are made from the sound of your own recording.\n\n#wallart #homedecor #thisorthat #personalizedgifts` };
      }
    }
    const fbFeed = a.find((p) => p.date === date && p.platforms.includes("Facebook") && !p.platforms.includes("TikTok") && !/Stories/.test(p.platforms.join()));
    const facebook = fbFeed
      ? { asset: fbFeed.asset.replace(/^out\//, "marketing/out/").replace(/^brag-output\//, "marketing/brag-output/"), caption: `${fbFeed.caption.replace(/\n\n#.*$/s, "")}\n\nMake yours: ${utm("facebook", date)}` }
      : { asset: tiktok.asset, caption: `${tiktok.caption.replace(/\n\n#.*$/s, "").replace(/\n\nSave this for later\..*$/s, "")}\n\n${utm("facebook", date)}` };
    const pin = PINS[i % PINS.length];
    const variant = Math.floor(i / PINS.length);
    plan.push({
      index: i,
      date,
      day: dayLabel(d),
      week,
      tiktok,
      facebook: { ...facebook, asset: facebook.asset + (fbFeed || /^FILM/.test(facebook.asset) ? "" : " (post as a Reel)") },
      pinterest: { asset: `marketing/out/daily/pins/${date}.jpg`, title: pin.titles[variant % pin.titles.length], description: pin.desc[variant % pin.desc.length], link: utm("pinterest", date, pin.link) },
    });
  }
  return plan;
}

// ── Pinterest topics ────────────────────────────────────────────────────────
interface PinTopic { kicker: string; headline: string; design: "night-of" | "herbarium"; colorway: string; kind?: "voice" | "heartbeat"; fields: Record<string, string>; titles: string[]; desc: string[]; link: string }
const PINS: PinTopic[] = [
  { kicker: "Memorial gift idea", headline: "Their voicemail, grown into a <span class=\"accent\">keepsake print</span>", design: "herbarium", colorway: "stone", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025" }, titles: ["Voicemail memorial gift: their voice as a botanical keepsake print", "Sympathy gift idea: turn a saved voicemail into framed art"], desc: ["Upload a saved voicemail and we grow it into a botanical print: every leaf drawn from their voice. A small code on the print plays the message again.", "A gentle memorial keepsake made from the sound of a loved one's voicemail or voice note. Framed or print-only, shipped in the US."], link: "/voicemail-memorial-art" },
  { kicker: "Wedding keepsake", headline: "Your vows, from the wedding video, as <span class=\"accent\">wall art</span>", design: "herbarium", colorway: "herbarium", fields: { title: "Our vows", subtitle: "Wedding video · June 14, 2025", names: "Emma & James" }, titles: ["Wedding vows art made from your wedding video", "Wedding keepsake idea: your vows as a botanical print"], desc: ["We use the sound of your vows from the wedding video (never the footage) to make one-of-a-kind wall art, with a code that plays them again.", "Turn the audio of your wedding vows into a framed botanical print. A meaningful first-anniversary or wedding gift."], link: "/wedding-vows-art" },
  { kicker: "First anniversary (paper)", headline: "A paper gift made from your <span class=\"accent\">wedding day</span>", design: "night-of", colorway: "dawn", fields: { names: "Emma & James", date: "2025-06-14", title: "Our vows, from the wedding video" }, titles: ["First anniversary paper gift: the moon from your wedding night", "Paper anniversary gift idea for him or her"], desc: ["The first anniversary is paper. This one is archival paper printed with the real moon from your wedding date, ringed by the sound of your vows.", "A personalized paper anniversary gift: your wedding date's real moon phase and your vows, framed or print-only."], link: "/anniversary-sound-wave-gift" },
  { kicker: "Anniversary gift", headline: "The moon on the night you <span class=\"accent\">met</span>", design: "night-of", colorway: "plum", fields: { names: "Maya & Theo", date: "2016-04-23", title: "Ten years" }, titles: ["Moon phase anniversary gift: the night you met", "What did the moon look like the night you met? Anniversary print"], desc: ["The real moon phase for your date, ringed by a recording of your voices. A personalized anniversary print, framed and shipped.", "Pick the date you met and we draw the moon exactly as it was, surrounded by the sound of your recording."], link: "/anniversary-sound-wave-gift" },
  { kicker: "Nursery art", headline: "Baby&rsquo;s heartbeat from the <span class=\"accent\">scan video</span>", design: "herbarium", colorway: "blush", kind: "heartbeat", fields: { title: "Olive", subtitle: "20-week scan video", names: "Mom & Dad", date: "2026-03-14" }, titles: ["Baby heartbeat art from your ultrasound video", "Nursery wall art made from your baby's heartbeat"], desc: ["Upload the heartbeat from the scan video in your camera roll and we grow it into a botanical nursery print.", "A keepsake for new parents: the first sound you heard of them, as framed nursery art."], link: "/gifts/first-baby-heartbeat-soundwave-art" },
  { kicker: "Pet memorial", headline: "Their bark at the door, <span class=\"accent\">kept</span>", design: "herbarium", colorway: "cyanotype", fields: { title: "Juniper", subtitle: "Phone video · the bark at the door", names: "Her people", date: "2012 — 2026" }, titles: ["Pet memorial gift made from a video of your dog", "Dog memorial art from their bark or purr"], desc: ["Upload a phone video of your pet. We use the sound (a bark, a purr, a happy sigh) to grow a botanical memorial print.", "A pet memorial keepsake made from your own video's sound, framed or print-only."], link: "/pet-memorial-sound-art" },
  { kicker: "Gift for grandparents", headline: "Fifty years, and the <span class=\"accent\">moon</span> from the first", design: "night-of", colorway: "midnight", fields: { names: "Grandma & Grandpa", date: "1976-12-24", title: "Fifty Christmases" }, titles: ["Golden anniversary gift for grandparents", "Gift for grandparents: the moon from their wedding night"], desc: ["The real moon from the night they married, ringed by a recording of them telling the story. A gift they'll actually hang.", "Record your grandparents telling how they met, and we'll ring the moon from their date with it."], link: "/anniversary-sound-wave-gift" },
  { kicker: "Proposal keepsake", headline: "The moment she said <span class=\"accent\">yes</span>", design: "night-of", colorway: "dawn", fields: { names: "Priya & Sam", date: "2025-09-20", title: "She said yes" }, titles: ["Proposal keepsake: the moon from the night you got engaged", "Engagement gift idea from the proposal video"], desc: ["Use the sound from your proposal video. We draw the moon from that night and ring it with the moment.", "An engagement keepsake made from the proposal clip on your phone, framed or print-only."], link: "/create" },
  { kicker: "Christmas gift for Mom", headline: "Mom&rsquo;s voice note, grown into a <span class=\"accent\">print</span>", design: "herbarium", colorway: "blush", fields: { title: "Mom", subtitle: "Voice note · 2 May 2024", names: "Love, all of us" }, titles: ["Sentimental Christmas gift for Mom", "Meaningful gift for Mom from a voice note"], desc: ["A botanical print grown from a voice note, voicemail or video of the family. A Christmas gift with a story.", "Turn a recording of the kids, a family song or a voicemail into a framed keepsake for Mom."], link: "/create" },
  { kicker: "Gift for your partner", headline: "Your night, your moon, your <span class=\"accent\">voices</span>", design: "night-of", colorway: "plum", fields: { names: "Alex & Jordan", date: "2021-02-13", title: "The first date" }, titles: ["Romantic Christmas gift for your wife or husband", "Personalized gift for your partner: the moon from your first date"], desc: ["The moon from your first date, ringed by a recording only the two of you have. Framed and shipped.", "A romantic, personal gift: the real moon on your special date, made from your own recording."], link: "/anniversary-sound-wave-gift" },
  { kicker: "Long-distance gift", headline: "The same moon, from <span class=\"accent\">both sides</span>", design: "night-of", colorway: "midnight", fields: { names: "Lena & Marco", date: "2024-08-17", title: "The night we met" }, titles: ["Long-distance relationship gift idea", "Gift for a long-distance boyfriend or girlfriend"], desc: ["The moon from the night you met, ringed by a voice note you sent each other. For the wall you both look at.", "A long-distance keepsake: your date's real moon and your own recording, framed."], link: "/create" },
  { kicker: "First dance", headline: "Your first dance, from <span class=\"accent\">table six</span>", design: "night-of", colorway: "dawn", fields: { names: "Maya & Jordan", date: "2024-09-12", title: "Our first dance, from table six" }, titles: ["First dance keepsake from the wedding video", "Wedding gift idea: the first dance as art"], desc: ["Someone filmed your first dance from table six. We use its sound to make a print with the moon from your wedding night.", "Turn the first-dance clip on your phone into personalized wedding art."], link: "/wedding-vows-art" },
  { kicker: "Save a voicemail", headline: "Save it first. Keep it <span class=\"accent\">forever.</span>", design: "herbarium", colorway: "stone", fields: { title: "Dad", subtitle: "Voicemail · 11 March 2021", names: "His kids" }, titles: ["How to save a voicemail before it's deleted (iPhone + Android)", "Don't lose that voicemail: how to save it"], desc: ["Carriers delete saved voicemails, and a new phone can wipe them. Step-by-step: save it on iPhone or Android, then keep two copies.", "Our guide to exporting a voicemail from any phone, plus how to turn it into a keepsake when you're ready."], link: "/how-to-save-a-voicemail" },
  { kicker: "Baby's first laugh", headline: "The first time they <span class=\"accent\">laughed</span>", design: "herbarium", colorway: "herbarium", fields: { title: "Theo's first laugh", subtitle: "Phone video · 4 months", names: "Mom & Dad" }, titles: ["Baby's first laugh keepsake from a phone video", "First birthday gift idea: their first laugh as art"], desc: ["The first laugh is gone in a week. Upload the video and we grow it into a botanical print.", "A keepsake for baby's first year made from a laugh, a coo or a first word."], link: "/gifts/baby-first-laugh-soundwave-art" },
];

const BGS: [string, string][] = [[C.romantic, C.wine], [C.botanical, C.botanicalInk], [C.film, C.ink], [C.night, C.nightInk]];
const FRAMES: ("black" | "natural" | "white")[] = ["white", "natural", "black", "white"];

function pinHtml(i: number): string {
  const t = PINS[i % PINS.length];
  const v = Math.floor(i / PINS.length);
  const [bg] = BGS[(i + v) % BGS.length];
  const frame = FRAMES[(i + v * 2) % FRAMES.length];
  const visual = framed(art({ design: t.design, colorway: t.colorway, kind: t.kind, fields: t.fields }), 520, frame);
  return doc(1000, 1500, `<div style="position:absolute;left:0;right:0;top:110px;display:flex;justify-content:center;transform:rotate(${v % 2 ? 1.5 : -1.5}deg)">${visual}</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:${C.paper};border-radius:36px 36px 0 0;padding:56px 64px">
      <div class="meta" style="font-size:22px;color:${C.soft}">${t.kicker}</div>
      <h2 class="display" style="font-size:80px;color:${C.ink};margin-top:18px">${t.headline}</h2>
      <div style="position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;align-items:center">${logo(28, C.ink)}<span class="meta" style="font-size:20px;color:${C.soft}">Demo · illustrative names</span></div>
    </div>`, bg);
}

// ── Video templates ─────────────────────────────────────────────────────────
const head = (text: string, at: number, color: string, size = 116, top = 300) =>
  `<h1 class="display e" style="position:absolute;left:84px;right:84px;top:${top}px;font-size:${size}px;color:${color};animation:up .7s ${at}s">${text}</h1>`;
const end = (start: number, dur: number, bg: string, ink: string, label: string, cta: string, fill: string, text: string) =>
  scene(start, dur + 1, bg, `
    <div style="position:absolute;left:0;right:0;top:700px;display:flex;flex-direction:column;align-items:center;text-align:center">
      <div class="e" style="animation:up .6s ${start + 0.1}s">${logo(64, ink)}</div>
      <p class="accent e" style="font-size:60px;color:${ink};margin-top:40px;animation:up .6s ${start + 0.3}s">${label}</p>
      <div class="e" style="margin-top:56px;animation:up .6s ${start + 0.55}s">${pill(cta, 40, fill, text)}</div>
      <p class="meta e" style="font-size:24px;color:${ink};opacity:.65;margin-top:40px;animation:up .6s ${start + 0.75}s">Prints from $35 · framed from $69</p>
    </div>`);

interface Generated { html: string; swaps: ReturnType<typeof swapper>["swaps"]; dur: number; bells: string; poster: number }

function moonVideo(dateIso: string, n: number): Generated {
  const dur = 9;
  const f = moonFacts(dateIso);
  const d = new Date(dateIso + "T00:00:00Z");
  const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const s1 = scene(0, 6.8, C.night, `
    <div class="meta e" style="position:absolute;left:84px;top:240px;font-size:30px;color:${C.moon};animation:up .6s .1s">Tonight · ${label}</div>
    ${head(`This is the moon <span class="accent">tonight.</span>`, 0.2, C.nightInk, 124, 300)}
    <div class="e" style="position:absolute;left:280px;top:600px;animation:pop .7s .5s">${framed(art({ design: "night-of", seed: `moon-${dateIso}`, fields: { names: "", date: dateIso, title: "Tonight" } }), 520, "black")}</div>
    <div class="meta e" style="position:absolute;left:0;right:0;top:1290px;text-align:center;font-size:34px;color:${C.moon};animation:up .6s 1.8s">${f.name} · about ${f.lit}% lit</div>
    <p class="accent e" style="position:absolute;left:100px;right:100px;top:1370px;text-align:center;font-size:50px;line-height:1.15;color:${C.nightInk};animation:up .7s 2.4s">${MOON_LINES[n % MOON_LINES.length]}</p>`);
  return { html: doc(W, H, s1 + end(6.8, dur, C.night, C.nightInk, "The Night Of: the real moon for any date.", "Find your moon", C.moon, C.night), C.paper, motionCss), swaps: {}, dur, bells: "0.5:78:0.06,6.9:74:0.07", poster: 150 };
}

function listVideo(n: number): Generated {
  const L = LISTS[n % LISTS.length];
  const [bg, ink] = BGS[n % 3];
  const dur = 11.5;
  const items = L.items
    .map((t, i) => `<div class="e" style="display:flex;gap:28px;align-items:baseline;margin-bottom:34px;animation:up .55s ${(1.5 + i * 1.2).toFixed(2)}s"><span class="display" style="font-size:72px;color:${ink};opacity:.35;min-width:56px">${i + 1}</span><span class="ui" style="font-size:46px;line-height:1.25;font-weight:500;color:${ink}">${t}</span></div>`)
    .join("");
  const s1 = scene(0, 9.0, bg, `
    ${head(`${L.title} <span class="accent">${L.accent}</span>`, 0.15, ink, 100, 250)}
    <div style="position:absolute;left:84px;right:84px;top:720px">${items}</div>`);
  const bells = [0, 1, 2, 3, 4].map((i) => `${(1.5 + i * 1.2).toFixed(2)}:${[79, 81, 83, 86, 88][i]}:0.022`).join(",") + ",9.1:74:0.07";
  return { html: doc(W, H, s1 + end(9.0, dur, bg, ink, "Keep the sound of it.", "Make yours", ink, bg), C.paper, motionCss), swaps: {}, dur, bells, poster: 240 };
}

function growVideo(n: number): Generated {
  const G = GROW_HOOKS[n % GROW_HOOKS.length];
  const dur = 9;
  const plant = art({ design: "herbarium", colorway: G.colorway, seed: `grow-${n}`, fields: { title: G.title, subtitle: G.subtitle, names: "", date: "" } });
  const s1 = scene(0, 6.8, C.botanical, `
    ${demoLabel(C.botanicalInk, 84, 170)}
    ${head(G.hook, 0.15, C.botanicalInk, 112, 250)}
    <div style="position:absolute;left:140px;top:900px;animation:out .35s 2.0s"><div>${waveBars(`grow-${n}`, 30, 800, 300, C.botanicalInk, 0.6)}</div></div>
    <div class="e" style="position:absolute;left:260px;top:640px;--r:1.5deg;animation:pop .6s 2.35s">${framed(`<div class="e" style="width:100%;height:100%;animation:grow 1.7s 2.5s cubic-bezier(.5,0,.3,1)">${plant}</div>`, 560, G.frame)}</div>
    <p class="meta e" style="position:absolute;left:0;right:0;top:1400px;text-align:center;font-size:26px;color:${C.botanicalInk};opacity:.75;animation:up .6s 4.3s">Each leaf: how loud that moment was</p>`);
  return { html: doc(W, H, s1 + end(6.8, dur, C.botanical, C.botanicalInk, "Herbarium: grown from your recording.", "Make yours", C.botanicalInk, C.botanical), C.paper, motionCss), swaps: {}, dur, bells: "4.2:81:0.06,6.9:74:0.07", poster: 165 };
}

function pairVideo(n: number): Generated {
  const P = PAIRS[n % PAIRS.length];
  const dur = 8.5;
  const one = (design: string, cw: string, letter: string, at: number, frame: "black" | "natural" | "white") => {
    const fields = design === "night-of" ? { names: "Sam & Alex", date: "2019-10-12", title: "The night we met" } : { title: "Our vows", subtitle: "Wedding video · June 14, 2025", names: "Emma & James" };
    return `<div class="e" style="text-align:center;animation:pop .6s ${at}s">${framed(art({ design: design as "night-of" | "herbarium", colorway: cw, fields }), 430, frame)}<div class="display" style="font-size:64px;color:${C.ink};margin-top:28px">${letter}</div><div class="meta" style="font-size:22px;color:${C.soft};margin-top:4px">${CW_NAME[cw]}</div></div>`;
  };
  const s1 = scene(0, 6.3, C.paper, `
    ${demoLabel(C.ink, 84, 170)}
    ${head(`Which would you <span class="accent">hang?</span>`, 0.15, C.ink, 120, 250)}
    <div style="position:absolute;left:60px;right:60px;top:560px;display:flex;justify-content:space-between">${one(P[0], P[1], "A", 0.5, n % 2 ? "black" : "natural")}${one(P[2], P[3], "B", 0.85, n % 2 ? "white" : "black")}</div>
    <p class="accent e" style="position:absolute;left:0;right:0;top:1360px;text-align:center;font-size:64px;color:${C.ink};animation:up .6s 2.2s">Comment A or B.</p>`);
  return { html: doc(W, H, s1 + end(6.3, dur, C.paper, C.ink, "Both are made from your own recording.", "Make yours", C.ink, C.paper), C.paper, motionCss), swaps: {}, dur, bells: "0.5:79:0.04,0.85:83:0.04,6.4:74:0.07", poster: 120 };
}

function generated(p: DayPlan): Generated | null {
  const k = p.tiktok.kind;
  if (k === "moon") return moonVideo(p.date, p.tiktok.n!);
  if (k === "list") return listVideo(p.tiktok.n!);
  if (k === "grow") return growVideo(p.tiktok.n!);
  if (k === "pair") return pairVideo(p.tiktok.n!);
  return null;
}

// ── Commands ────────────────────────────────────────────────────────────────
async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  const plan = buildPlan();
  if (cmd === "plan") {
    fs.mkdirSync("marketing/social", { recursive: true });
    fs.writeFileSync("marketing/social/daily.json", JSON.stringify(plan, null, 1));
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [["Date", "Day", "Week", "Platform", "Asset", "Hook / title", "Caption / description", "Link"].map(esc).join(",")];
    for (const p of plan) {
      rows.push([p.date, p.day, String(p.week), "TikTok (+ Reels, Shorts)", p.tiktok.asset, p.tiktok.hook, p.tiktok.caption, "Link in bio"].map(esc).join(","));
      rows.push([p.date, p.day, String(p.week), "Facebook", p.facebook.asset, "", p.facebook.caption, ""].map(esc).join(","));
      rows.push([p.date, p.day, String(p.week), "Pinterest", p.pinterest.asset, p.pinterest.title, p.pinterest.description, p.pinterest.link].map(esc).join(","));
    }
    fs.writeFileSync("marketing/social/daily.csv", rows.join("\n") + "\n");
    const counts = plan.reduce<Record<string, number>>((m, p) => ((m[p.tiktok.kind] = (m[p.tiktok.kind] ?? 0) + 1), m), {});
    console.log("days", plan.length, counts);
    return;
  }
  if (cmd === "pins") {
    const dir = path.join(OUT, "pins");
    fs.mkdirSync(dir, { recursive: true });
    const browser = await launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    for (const p of plan) {
      await page.setContent(pinHtml(p.index), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(dir, `${p.date}.jpg`), type: "jpeg", quality: 90 });
    }
    await browser.close();
    console.log("pins", plan.length, dir);
    return;
  }
  const todo = plan.filter((p) => p.tiktok.kind !== "anchor");
  if (cmd === "still") {
    const p = todo[Number(a1)];
    const g = generated(p)!;
    await renderFilm({ html: g.html, swaps: g.swaps, width: W, height: H, duration: g.dur, workDir: path.join(OUT, "work", p.date) }, a2.split(",").map(Number));
    return;
  }
  if (cmd === "videos") {
    const from = Number(a1 ?? 0);
    const to = Number(a2 ?? todo.length);
    fs.mkdirSync(path.join(OUT, "video"), { recursive: true });
    for (const p of todo.slice(from, to)) {
      const g = generated(p)!;
      const workDir = path.join(OUT, "work", p.date);
      await renderFilm({ html: g.html, swaps: g.swaps, width: W, height: H, duration: g.dur, workDir });
      const wav = path.join(workDir, "soundtrack.wav");
      execFileSync("python3", ["scripts/marketing/brag_audio.py", "generic", wav, String(g.dur), String(p.index), g.bells], { stdio: "ignore" });
      const mp4 = path.resolve(p.tiktok.asset);
      encodeFilm(workDir, g.poster, wav, mp4, mp4.replace(/\.mp4$/, "-poster.jpg"), 22);
      fs.rmSync(path.join(workDir, "frames"), { recursive: true, force: true });
    }
    return;
  }
  throw new Error("usage: daily.ts plan | pins | videos [from] [to] | still <index> <t,t>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
