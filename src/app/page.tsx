import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";
import Testimonials from "@/components/Testimonials";
import Artwork from "@/components/art/Artwork";
import FramedArtwork from "@/components/art/FramedArtwork";
import { CTA } from "@/components/brand/Button";
import Meta from "@/components/brand/Meta";
import PhoneMemory from "@/components/brand/PhoneMemory";
import Reveal from "@/components/brand/Reveal";
import { MemoryTrace, WaveEdge, WaveLine } from "@/components/brand/shapes";
import { getDesign, samplePeaks, type ArtFields } from "@/lib/art";
import { OCCASIONS, PRINT_SIZES, formatPrice } from "@/lib/catalog";

const night = getDesign("night-of")!;
const herb = getDesign("herbarium")!;

const EXAMPLES: {
  who: string;
  meta: [string, string][];
  quote: string;
  phone: { file: string; stamp: string; length: string; scene: "dusk" | "garden" | "night" | "warm" | "blue" };
  design: string;
  colorway: string;
  frame: string;
  kind: "voice" | "heartbeat";
  fields: ArtFields;
}[] = [
  {
    who: "Maya + Jordan",
    meta: [
      ["Source", "Wedding video"],
      ["Recorded", "Sep 12 2024"],
      ["Length", "00:21.08"],
    ],
    quote: "the first dance, filmed from table six",
    phone: { file: "IMG_2208.MOV", stamp: "SEP 12 2024 · 22:14", length: "00:21", scene: "warm" },
    design: "night-of",
    colorway: "dawn",
    frame: "natural",
    kind: "voice",
    fields: { date: "2024-09-12", names: "Maya & Jordan", title: "Our first dance, from table six", message: "", subtitle: "", song: "" },
  },
  {
    who: "Walter",
    meta: [
      ["Source", "Saved voicemail"],
      ["Recorded", "Mar 11 2021"],
      ["Length", "00:14.20"],
    ],
    quote: "“Hey kiddo, it’s Dad. Just wanted to hear your voice.”",
    phone: { file: "Voicemail.m4a", stamp: "MAR 11 2021 · 18:03", length: "00:14", scene: "blue" },
    design: "herbarium",
    colorway: "stone",
    frame: "white",
    kind: "voice",
    fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025", message: "Hey kiddo, it's Dad. Just wanted to hear your voice.", song: "" },
  },
  {
    who: "Juniper",
    meta: [
      ["Source", "Phone video"],
      ["Recorded", "May 3 2014"],
      ["Length", "00:06.51"],
    ],
    quote: "her bark at the garden gate",
    phone: { file: "IMG_0513.MOV", stamp: "MAY 3 2014 · 08:40", length: "00:06", scene: "garden" },
    design: "herbarium",
    colorway: "cyanotype",
    frame: "black",
    kind: "voice",
    fields: { title: "Juniper", subtitle: "Her garden bark", names: "The Alvarez family", date: "2011 — 2026", message: "Always first to the gate.", song: "" },
  },
];

const SOURCES = ["a saved voicemail", "wedding vows", "a Snapchat memory", "a baby’s laugh", "a dog’s bark", "a proposal clip", "Grandma singing", "a voice note", "an original recording"];

function ArrowDown() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <path d="M14 3v20M6 15l8 8 8-8" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export default function Home() {
  const fromPrint = Math.min(...PRINT_SIZES.map((s) => s.price.print));
  const fromFramed = Math.min(...PRINT_SIZES.map((s) => s.price.framed));

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main id="main" className="flex-1">
        {/* ── 1 · HERO ─────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-14">
          <MemoryTrace seed="hero-trace" fill="var(--film)" className="pointer-events-none absolute -right-[20%] top-[8%] h-[70%] w-[95%] opacity-90 lg:-right-[6%] lg:w-[62%]" />
          <div className="relative grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Meta
                className="mb-6"
                rows={[
                  ["Source", "Your recording or video"],
                  ["Output", "Keepsake wall art"],
                ]}
              />
              <h1 className="display text-[15vw] sm:text-[11vw] lg:text-[8.2vw] xl:text-[124px]">
                Turn a moment you can <span className="accent !font-normal">hear</span> into art you can <span className="accent !font-normal">keep.</span>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
                Upload a voice memo, voicemail, wedding clip, Snapchat memory or other personal recording. We use the sound inside it to create one-of-a-kind keepsake wall art.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <CTA href="/create">Create your piece</CTA>
                <CTA href="#how-it-works" variant="paper">
                  See how it works
                </CTA>
              </div>
              <p className="meta mt-6 opacity-70">
                Prints from {formatPrice(fromPrint)} · Framed from {formatPrice(fromFramed)} · Free US shipping
              </p>
            </div>
            <div className="relative lg:col-span-5">
              <div className="relative mx-auto w-[78%] max-w-[440px] rotate-[2deg] lg:w-[86%]">
                <FramedArtwork designId={night.id} fields={night.sample} colorwayId="midnight" qrStyle="discreet" frameFinish="black" idPrefix="hero" title="The Night Of, framed" />
              </div>
              <div className="anim-float absolute -bottom-8 -left-1 w-[34%] max-w-[170px] sm:left-[4%]" style={{ "--rot": "-7deg" } as React.CSSProperties}>
                <PhoneMemory file="IMG_4471.MOV" stamp="JUN 14 2025 · 21:42" length="00:13" scene="night" seed="hero-phone" />
              </div>
              <p className="accent absolute -bottom-14 left-[38%] hidden text-xl sm:block">
                ← we use the sound, not the footage
              </p>
            </div>
          </div>
        </section>

        {/* ── 2 · THE TRANSFORMATION ───────────────────────────────── */}
        <WaveEdge seed="edge-film" fill="var(--film)" />
        <section className="bg-film">
          <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 sm:px-8">
            <h2 className="display max-w-5xl text-[12vw] sm:text-[8vw] lg:text-[96px]">
              From a clip on your phone to a print on your <span className="accent !font-normal">wall.</span>
            </h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
              {[
                {
                  n: "01",
                  label: "Your video / voice note / recording",
                  body: (
                    <div className="mx-auto w-[48%] md:w-[70%]">
                      <PhoneMemory file="IMG_2208.MOV" stamp="SEP 12 2024 · 22:14" length="00:21" scene="warm" seed="step-phone" />
                    </div>
                  ),
                },
                {
                  n: "02",
                  label: "We extract the moment",
                  body: (
                    <div className="flex aspect-[9/16] max-h-[340px] w-full flex-col justify-center border-2 border-ink bg-paper px-4">
                      <WaveLine seed="step-phone" className="h-24 w-full text-ink" count={120} />
                      <Meta className="mt-4" rows={[["Length", "00:21.08"], ["Peaks", "400 samples"]]} />
                    </div>
                  ),
                },
                {
                  n: "03",
                  label: "It shapes your artwork",
                  body: (
                    <Reveal variant="grow-up" className="border-2 border-ink">
                      <Artwork designId={herb.id} fields={herb.sample} peaks={samplePeaks("step-phone", "voice")} showQr={false} idPrefix="step-art" />
                    </Reveal>
                  ),
                },
                {
                  n: "04",
                  label: "We print + frame it",
                  body: <FramedArtwork designId={herb.id} fields={herb.sample} peaks={samplePeaks("step-phone", "voice")} frameFinish="natural" qrStyle="discreet" idPrefix="step-frame" />,
                },
              ].map((s) => (
                <li key={s.n} className="flex flex-col">
                  <div className="mb-4 flex items-baseline gap-3 border-b-2 border-ink pb-2">
                    <span className="display text-4xl">{s.n}</span>
                    <span className="meta">{s.label}</span>
                  </div>
                  <div className="flex flex-1 items-center">{s.body}</div>
                </li>
              ))}
            </ol>
            <p className="meta mt-10 max-w-2xl opacity-80">
              Videos are welcome — your browser pulls out the soundtrack and only the sound is uploaded. The footage never leaves your phone.
            </p>
          </div>
        </section>
        <WaveEdge seed="edge-film-b" fill="var(--film)" flip />

        {/* ── 3 · REAL MEMORIES (demo examples) ────────────────────── */}
        <section className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 className="display max-w-4xl text-[12vw] sm:text-[8vw] lg:text-[96px]">
              Made from something that <span className="accent !font-normal">actually happened.</span>
            </h2>
            <p className="meta max-w-[260px] opacity-70">Demo examples — illustrative people and recordings, not customer orders.</p>
          </div>

          <div className="mt-16 space-y-24">
            {EXAMPLES.map((e, i) => (
              <Reveal key={e.who} className={`grid items-center gap-8 md:grid-cols-12 ${i % 2 ? "md:[&>*:first-child]:order-3" : ""}`}>
                <div className="md:col-span-4">
                  <div className="display text-5xl sm:text-6xl">{e.who}</div>
                  <Meta className="mt-4" rows={e.meta} />
                  <p className="accent mt-5 text-2xl leading-snug">{e.quote}</p>
                  <Link href={`/create?design=${e.design}`} className="meta mt-4 inline-flex min-h-[44px] items-center underline decoration-2 underline-offset-4">
                    Make one like this →
                  </Link>
                </div>
                <div className="md:col-span-3">
                  <div className="mx-auto w-[46%] md:w-[72%]">
                    <PhoneMemory {...e.phone} seed={`ex-${i}`} />
                  </div>
                  <WaveLine seed={`ex-${i}`} className="mt-5 h-10 w-full" count={90} animate={false} />
                </div>
                <div className="md:col-span-5">
                  <div className={`mx-auto w-[82%] ${i % 2 ? "-rotate-[1.5deg]" : "rotate-[1.5deg]"}`}>
                    <FramedArtwork designId={e.design} colorwayId={e.colorway} fields={e.fields} peaks={samplePeaks(`ex-${i}`, e.kind)} frameFinish={e.frame} qrStyle="discreet" idPrefix={`ex-art-${i}`} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* What can become art */}
          <div className="mt-28 border-t-2 border-ink pt-10">
            <p className="meta mb-6">What can become art?</p>
            <p className="display text-[9vw] leading-[0.95] sm:text-[6vw] lg:text-[72px]">
              {SOURCES.map((s, i) => (
                <span key={s}>
                  <span className={i % 3 === 1 ? "accent !font-normal" : ""}>{s}</span>
                  {i < SOURCES.length - 1 && <span className="mx-3 text-signal">/</span>}
                </span>
              ))}
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <p className="text-xl leading-relaxed">
                <strong>Already have the memory on your phone?</strong> Upload a video or audio file. We extract the sound and use it to shape your artwork.
              </p>
              <p className="meta self-end opacity-70">MP4 · MOV · M4V · M4A · MP3 · WAV · AAC · WebM — or record in your browser. Use recordings you made or have permission to use.</p>
            </div>
          </div>
        </section>

        {/* ── 4 · THE COLLECTIONS ──────────────────────────────────── */}
        <WaveEdge seed="edge-night" fill="var(--night)" />
        <section id="the-night-of" className="on-dark bg-night text-night-ink">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-24 pt-10 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="meta text-night-soft">Collection 01 · Night</p>
              <h2 className="display mt-4 text-[20vw] lg:text-[10vw] xl:text-[156px]">The Night Of</h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed">{night.tagline}</p>
              <p className="meta mt-6 max-w-md text-night-soft">Often chosen for the night you met, a wedding, a proposal, an anniversary, a birth — or a night you never want to forget.</p>
              <div className="mt-8 flex items-center gap-3">
                {night.colorways.map((c) => (
                  <span key={c.id} className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full border-2 border-night-ink" style={{ background: `linear-gradient(135deg, ${c.swatch[0]} 50%, ${c.swatch[1]} 50%)` }} />
                    <span className="meta">{c.name}</span>
                  </span>
                ))}
              </div>
              <div className="mt-10">
                <CTA href="/create?design=night-of">Start with The Night Of</CTA>
              </div>
            </div>
            <Reveal className="lg:col-span-6">
              <div className="mx-auto w-[82%] max-w-[520px] -rotate-[1.5deg]">
                <FramedArtwork designId={night.id} fields={{ date: "2019-10-12", names: "Sam & Alex", title: "Our first phone call", message: "Five years of saying goodnight.", subtitle: "", song: "" }} peaks={samplePeaks("night-coll", "voice")} colorwayId="midnight" frameFinish="black" qrStyle="discreet" idPrefix="coll-night" />
              </div>
            </Reveal>
          </div>
        </section>
        <div className="bg-night">
          <WaveEdge seed="edge-botanical" fill="var(--botanical)" />
        </div>
        <section id="herbarium" className="bg-botanical text-botanical-ink">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-24 pt-10 sm:px-8 lg:grid-cols-12">
            <Reveal className="order-2 lg:order-1 lg:col-span-6">
              <div className="mx-auto w-[82%] max-w-[520px] rotate-[1.5deg]">
                <FramedArtwork designId={herb.id} fields={herb.sample} colorwayId="herbarium" frameFinish="natural" qrStyle="discreet" idPrefix="coll-herb" />
              </div>
            </Reveal>
            <div className="order-1 lg:order-2 lg:col-span-6">
              <p className="meta opacity-70">Collection 02 · Botanical</p>
              <h2 className="display mt-4 text-[20vw] lg:text-[10vw] xl:text-[156px]">Herbarium</h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed">{herb.tagline}</p>
              <p className="meta mt-6 max-w-md opacity-75">Made for vows, voices, laughter, family memories, pet sounds and recordings worth keeping.</p>
              <div className="mt-8 border-l-4 border-botanical-leaf pl-5">
                <p className="meta mb-2">How your specimen grows</p>
                <p className="max-w-lg leading-relaxed">
                  We measure how loud your recording is from its first second to its last. Each leaf’s length is the loudness at that moment, from root to tip — so the plant is grown from your recording, not picked from a preset.
                </p>
              </div>
              <div className="mt-10">
                <CTA href="/create?design=herbarium">Start with Herbarium</CTA>
              </div>
            </div>
          </div>
        </section>
        <div className="bg-botanical">
          <WaveEdge seed="edge-romantic" fill="var(--romantic)" />
        </div>

        {/* ── 5 · WHY YOUR RECORDING ───────────────────────────────── */}
        <section className="bg-romantic text-romantic-wine">
          <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
            <p className="display text-[11vw] sm:text-[8vw] lg:text-[104px]">
              A song may remind you of the moment. <span className="accent !font-normal">Your recording is the moment.</span>
            </p>
            <ul className="mt-12 grid gap-4 text-lg sm:grid-cols-2 lg:grid-cols-4">
              {["The way their voice sounded", "Laughter in the background", "The room you were in", "The small imperfect sounds"].map((t) => (
                <li key={t} className="border-t-2 border-romantic-wine pt-3">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 6 · QR / LISTEN LINK ─────────────────────────────────── */}
        <section className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-5">
            <h2 className="display text-[13vw] sm:text-[8vw] lg:text-[88px]">
              Scan it. <span className="accent !font-normal">Hear it again.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Add an optional code, printed discreetly — tone-on-tone, like a blind stamp. Point any phone camera at it. No app.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
            <div className="border-2 border-ink bg-paper-2 p-6 shadow-[6px_6px_0_#151412]">
              <p className="meta">Option A · default</p>
              <p className="display mt-3 text-4xl">Your recording</p>
              <p className="mt-3 leading-relaxed">The code plays the recording you uploaded, from a private link nobody can guess.</p>
            </div>
            <div className="border-2 border-ink bg-paper-2 p-6 shadow-[6px_6px_0_#151412]">
              <p className="meta">Option B</p>
              <p className="display mt-3 text-4xl">Any link you choose</p>
              <p className="mt-3 leading-relaxed">A Spotify or Apple Music song, a YouTube video, a shared album — the code opens it.</p>
            </div>
            <p className="meta sm:col-span-2 opacity-75">
              The link is only where the code points. We never download or analyse it — your artwork is made from the file you upload.
            </p>
          </div>
        </section>

        {/* ── 7 · THE OBJECT ───────────────────────────────────────── */}
        <section className="border-y-2 border-ink bg-paper-2">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="meta mb-4">Detail · Herbarium specimen label, shown at roughly print size</p>
              <div className="relative aspect-[4/3] overflow-hidden border-2 border-ink bg-paper">
                <div className="absolute left-[-99%] top-[-239%] w-[210%]">
                  <Artwork designId={herb.id} fields={herb.sample} colorwayId="herbarium" qrStyle="discreet" idPrefix="detail" />
                </div>
              </div>
              <p className="meta mt-3 opacity-70">Sent to the printer as vector artwork, so type and linework stay sharp at every size.</p>
            </div>
            <div className="lg:col-span-5">
              <h2 className="display text-[12vw] sm:text-[7vw] lg:text-[72px]">A real object, not a JPEG.</h2>
              <ul className="mt-8 space-y-4 text-lg">
                <li className="border-t-2 border-ink pt-3">Pigment inks on archival matte fine-art paper</li>
                <li className="border-t-2 border-ink pt-3">Solid wood frame — black, natural oak or white — with a white mount and shatterproof glazing</li>
                <li className="border-t-2 border-ink pt-3">Made to order in 3–5 business days, tracked US delivery</li>
              </ul>
              <table className="mt-10 w-full text-left">
                <thead>
                  <tr className="meta">
                    <th className="pb-2 font-normal">Size</th>
                    <th className="pb-2 font-normal">Print</th>
                    <th className="pb-2 font-normal">Framed</th>
                  </tr>
                </thead>
                <tbody className="text-lg">
                  {PRINT_SIZES.map((s) => (
                    <tr key={s.id} className="border-t border-ink/30">
                      <td className="py-2.5">{s.label}</td>
                      <td className="py-2.5">{formatPrice(s.price.print)}</td>
                      <td className="py-2.5 font-semibold">{formatPrice(s.price.framed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── 8 · HOW IT WORKS ─────────────────────────────────────── */}
        <section id="how-it-works" className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-20 sm:px-8 lg:py-28">
          <p className="meta mb-8">How it works</p>
          <ol className="grid gap-12 md:grid-cols-3">
            {[
              ["Upload a memory", "An audio or video recording you made or have permission to use. Only its sound is used."],
              ["Make it yours", "Choose The Night Of or Herbarium, then add names, a date and a short note. The preview is exactly what we print."],
              ["We print + frame it", "Archival paper, a real wood frame if you like, shipped free in the US. An optional code plays it back."],
            ].map(([t, b], i) => (
              <li key={t}>
                <span className="display block text-[28vw] leading-none text-signal md:text-[12vw] xl:text-[180px]">{i + 1}</span>
                <span className="display mt-2 block text-4xl sm:text-5xl">{t}</span>
                <p className="mt-4 max-w-sm text-lg leading-relaxed text-ink-soft">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 9 · OCCASIONS ────────────────────────────────────────── */}
        <section id="occasions" className="scroll-mt-20 border-t-2 border-ink">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8">
            <p className="meta mb-6">Who it’s for</p>
            <ul>
              {OCCASIONS.map((o) => (
                <li key={o.id} className="border-b-2 border-ink">
                  <Link href={o.landing ?? `/create?occasion=${o.id}`} className="group flex min-h-[64px] items-center justify-between gap-4 py-3">
                    <span className="display text-[10vw] transition-transform duration-300 group-hover:translate-x-3 sm:text-[6vw] lg:text-[72px]">{o.label}</span>
                    <span className="meta hidden text-right opacity-70 sm:block">{getDesign(o.designId)?.name} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Testimonials />
        <FAQ />

        {/* ── 10 · FINAL CTA ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-signal">
          <MemoryTrace seed="final" fill="rgba(21,20,18,.08)" className="pointer-events-none absolute inset-x-0 top-1/2 h-[140%] w-full -translate-y-1/2" />
          <div className="relative mx-auto max-w-[1440px] px-4 py-24 sm:px-8">
            <h2 className="display text-[18vw] lg:text-[180px]">
              A moment you can <span className="accent !font-normal">hold.</span>
            </h2>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <CTA href="/create" variant="ink">
                Create your piece
              </CTA>
              <span className="flex items-center gap-2 text-lg">
                <ArrowDown /> Start with a recording you already have
              </span>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
