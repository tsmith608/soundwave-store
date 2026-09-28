/**
 * Artwork engine tests. Run: npx tsx tests/test_art_engine.ts  (npm run test:art)
 *
 * Covers every sellable design × colourway × size, hostile input, text
 * fitting, the moon-phase maths, peak sanitising and the checkout contract.
 */
import { DESIGNS, EXPLORATION_DESIGNS, RETIRED_DESIGNS, getSellableDesign, cleanFields, getDesign, renderArtwork, sanitizePeaks, samplePeaks } from "../src/lib/art";
import { moonPhase, parseDate } from "../src/lib/art/dates";
import { F, measure, fitWrap } from "../src/lib/art/fonts";
import { PRINT_SIZES } from "../src/lib/catalog";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// 1. Every sellable design renders in every colourway and size, with and without QR
for (const d of DESIGNS) {
  for (const c of d.colorways) {
    for (const s of PRINT_SIZES) {
      for (const showQr of [true, false]) {
        const svg = renderArtwork(d, d.sample, samplePeaks(d.sampleSeed, d.sampleKind), { widthIn: s.widthIn, heightIn: s.heightIn, colorwayId: c.id, showQr, qrUrl: "https://example.com/l/abcdefghijkl" });
        const tag = `${d.id}/${c.id}/${s.id}/qr=${showQr}`;
        check(`${tag} starts with <svg`, svg.startsWith("<svg"));
        check(`${tag} has physical size`, svg.includes(`width="${s.widthIn}in"`) && svg.includes(`height="${s.heightIn}in"`));
        check(`${tag} no NaN/undefined`, !/NaN|undefined|Infinity/.test(svg), (svg.match(/.{20}(NaN|undefined|Infinity).{20}/) || [""])[0]);
        check(`${tag} uses colourway paper`, svg.includes(c.paper));
        check(`${tag} QR ${showQr ? "present" : "absent"}`, showQr ? svg.includes('shape-rendering="crispEdges"') : !svg.includes('shape-rendering="crispEdges"'));
      }
    }
  }
}

// 2. Explorations still render (kept for reference)
for (const d of EXPLORATION_DESIGNS) {
  const svg = renderArtwork(d, d.sample, null, { widthIn: 12, heightIn: 16, showQr: true });
  check(`exploration ${d.id} renders`, svg.startsWith("<svg") && !/NaN/.test(svg));
}

// 2b. Pivot: only the moon and botanical are sold; retired designs still render for old orders
check("sellable designs are night-of + herbarium", DESIGNS.map((d) => d.id).join(",") === "night-of,herbarium");
for (const d of RETIRED_DESIGNS) {
  check(`retired ${d.id} not sellable`, getSellableDesign(d.id) === undefined);
  check(`retired ${d.id} still renders`, renderArtwork(d, d.sample, null, { widthIn: 12, heightIn: 16, showQr: true }).startsWith("<svg"));
}
// discreet QR has no caption and uses a blended (non-ink) colour
for (const d of DESIGNS) for (const c of d.colorways) {
  const std = renderArtwork(d, d.sample, null, { widthIn: 12, heightIn: 16, colorwayId: c.id, showQr: true, qrStyle: "standard" });
  const dis = renderArtwork(d, d.sample, null, { widthIn: 12, heightIn: 16, colorwayId: c.id, showQr: true, qrStyle: "discreet" });
  check(`${d.id}/${c.id} discreet drops caption`, !/SCAN TO LISTEN/.test(dis) && /SCAN TO LISTEN/.test(std));
}

// 3. Hostile input is escaped and never produces markup
const evil = { title: `</text><script>alert(1)</script>&"'`, subtitle: "<img src=x onerror=alert(1)>", names: "A & B <3", date: "2025-02-30", message: "]]><!--" };
for (const d of DESIGNS) {
  const svg = renderArtwork(d, cleanFields(d, evil), samplePeaks("x"), { widthIn: 12, heightIn: 16, showQr: true, photoHref: `javascript:alert(1)" onload="x` });
  check(`${d.id} escapes <script>`, !svg.includes("<script"));
  check(`${d.id} escapes <img`, !svg.includes("<img"));
  check(`${d.id} escapes raw ampersand`, !/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(svg));
  check(`${d.id} photo href cannot break attribute`, !svg.includes('" onload="'));
}

// 4. Very long input still fits: every <text> stays inside the canvas
const long = { title: "W".repeat(60), subtitle: "M".repeat(60), names: "Bartholomew-Maximilian & Anastasia-Josephine", date: "2025-06-14", message: "word ".repeat(40) };
for (const d of DESIGNS) {
  const f = cleanFields(d, long);
  const svg = renderArtwork(d, f, null, { widthIn: 8, heightIn: 10, showQr: true });
  const xs = [...svg.matchAll(/<text x="([\d.-]+)"/g)].map((m) => parseFloat(m[1]));
  check(`${d.id} long text anchors inside canvas`, xs.every((x) => x >= 0 && x <= 1200), xs.filter((x) => x < 0 || x > 1200).join(","));
  const ys = [...svg.matchAll(/<text x="[\d.-]+" y="([\d.-]+)"/g)].map((m) => parseFloat(m[1]));
  check(`${d.id} long text inside canvas height`, ys.every((y) => y > 0 && y < 1500), ys.filter((y) => y <= 0 || y >= 1500).join(","));
}

// 5. Field cleaning respects maxLength and required fields exist
for (const d of DESIGNS) {
  const f = cleanFields(d, long);
  for (const spec of d.fields) check(`${d.id}.${spec.key} ≤ ${spec.maxLength}`, f[spec.key].length <= spec.maxLength);
  check(`${d.id} has a required field`, d.fields.some((x) => x.required));
}

// 6. Text measurement and wrapping
check("measure grows with size", measure("Hello", F.display, 20) < measure("Hello", F.display, 40));
check("tracking widens text", measure("Hello", F.sans, 20, 0.2) > measure("Hello", F.sans, 20));
const fw = fitWrap("The quick brown fox jumps over the lazy dog again and again", F.garamondItalic, 300, 2, 40, 10);
check("fitWrap respects maxLines", fw.lines.length <= 2);
check("fitWrap lines fit width", fw.lines.every((l) => measure(l, F.garamondItalic, fw.size) <= 300.5));

// 7. Moon phase against known 2025 events (UTC): full 2025-06-11, new 2025-06-25, full 2025-12-04
const near = (a: number, b: number, tol = 0.04) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) <= tol;
check("full moon 2025-06-11", near(moonPhase(parseDate("2025-06-11")!), 0.5));
check("new moon 2025-06-25", near(moonPhase(parseDate("2025-06-25")!), 0));
check("full moon 2025-12-04", near(moonPhase(parseDate("2025-12-04")!), 0.5));
check("overflowing dates rejected", parseDate("2025-13-45") === null && parseDate("2025-02-30") === null);
check("valid leap day accepted", parseDate("2024-02-29") !== null);

// 8. Peak sanitising (untrusted checkout input)
check("rejects non-array peaks", sanitizePeaks("nope") === null);
check("rejects tiny arrays", sanitizePeaks([1, 2]) === null);
check("rejects all-zero", sanitizePeaks(new Array(50).fill(0)) === null);
check("rejects huge arrays", sanitizePeaks(new Array(5000).fill(0.5)) === null);
const sp = sanitizePeaks([...new Array(20).fill(0.5), 9, -3, "0.2", NaN]);
check("clamps and coerces peaks", !!sp && sp.every((v) => v >= 0 && v <= 1));

// 9. Unknown design / colourway fall back safely
check("unknown design is undefined", getDesign("nope") === undefined);
const d0 = DESIGNS[0];
check("unknown colourway falls back", renderArtwork(d0, d0.sample, null, { widthIn: 12, heightIn: 16, showQr: false, colorwayId: "nope" }).includes(d0.colorways[0].paper));

console.log(`\nArt engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
