import React from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";
import Testimonials from "@/components/Testimonials";
import Artwork from "@/components/art/Artwork";
import { DESIGNS, getDesign, samplePeaks } from "@/lib/art";
import { PRINT_SIZES, formatPrice } from "@/lib/catalog";

const EXAMPLES = [
  { img: "/mockups/example-first-dance.jpg", label: "A first-dance song", design: "Liner Notes", href: "/create?occasion=wedding" },
  { img: "/mockups/example-voicemail.jpg", label: "Dad's last voicemail", design: "In Memoriam", href: "/create?occasion=memorial" },
  { img: "/mockups/example-night-we-met.jpg", label: "The night we met", design: "The Night Of", href: "/create?occasion=anniversary" },
  { img: "/mockups/example-vows.jpg", label: "Wedding vows", design: "The Arch", href: "/create?occasion=vows" },
  { img: "/mockups/example-heartbeat.jpg", label: "A heartbeat at 20 weeks", design: "Herbarium", href: "/create?occasion=baby" },
  { img: "/mockups/example-pet.jpg", label: "Biscuit's hello", design: "In Memoriam", href: "/create?occasion=pet" },
];

function VoiceMemoCard() {
  const peaks = samplePeaks("voice-memo-demo", "voice", 60);
  return (
    <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(40,30,20,.12)] p-5 w-full max-w-[300px]">
      <div className="text-[11px] text-[#9E968F]">Voice Memos</div>
      <div className="mt-1 text-[15px] font-medium text-[#2D2A26]">Mom — voicemail</div>
      <div className="text-xs text-[#9E968F]">Mar 11, 2021 · 0:14</div>
      <svg viewBox="0 0 240 48" className="mt-4 w-full h-12" aria-hidden>
        {peaks.map((p, i) => (
          <line key={i} x1={i * 4 + 2} x2={i * 4 + 2} y1={24 - Math.max(1.5, p * 20)} y2={24 + Math.max(1.5, p * 20)} stroke="#2D2A26" strokeWidth="2" strokeLinecap="round" />
        ))}
      </svg>
      <div className="mt-3 flex items-center gap-3 text-xs text-[#6B655F]">
        <span className="w-7 h-7 rounded-full bg-[#2D2A26] text-white flex items-center justify-center">▶</span>
        “Call me when you get home, sweetheart…”
      </div>
    </div>
  );
}

export default function Home() {
  const memoriam = getDesign("in-memoriam")!;
  const fromPrint = Math.min(...PRINT_SIZES.map((s) => s.price.print));
  const fromFramed = Math.min(...PRINT_SIZES.map((s) => s.price.framed));

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-16 lg:pb-24 grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-14 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7A736B]">Personalised wall art from real recordings</p>
            <h1 className="mt-5 font-serif text-[44px] leading-[1.02] sm:text-6xl lg:text-[68px] tracking-tight">
              Your song, your vows, a voice you love — made into art for the wall.
            </h1>
            <p className="mt-6 text-lg text-[#4A453F] leading-relaxed max-w-xl">
              Upload the recording and choose a finished design. We print it on archival paper, frame it, and add a small code that plays the sound back.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="px-7 py-3.5 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm tracking-wide">
                Create yours
              </Link>
              <Link href="/designs" className="px-7 py-3.5 rounded-md border border-[#CFC6BA] hover:border-[#2D2A26] text-sm">
                See the five designs
              </Link>
            </div>
            <p className="mt-5 text-sm text-[#7A736B]">
              Prints from {formatPrice(fromPrint)} · framed from {formatPrice(fromFramed)} · free tracked US shipping
            </p>
          </div>
          <div className="relative">
            <Image
              src="/mockups/hero-herbarium.jpg"
              alt="A framed Herbarium print: a botanical stem whose leaves are drawn from a first-dance song, with a specimen label reading ‘Our first dance’"
              width={1600}
              height={1300}
              priority
              className="w-full h-auto"
            />
          </div>
        </section>

        {/* Occasions */}
        <section id="occasions" className="border-t border-[#E6DFD6] py-16 lg:py-24 scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <h2 className="font-serif text-4xl sm:text-5xl max-w-2xl">What people keep</h2>
              <p className="text-[#6B655F] max-w-md">Each of these is a real layout from the studio with example words. Tap one to start with the same design.</p>
            </div>
            <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
              {EXAMPLES.map((e) => (
                <Link key={e.img} href={e.href} className="group">
                  <div className="overflow-hidden bg-[#E6E0D6]">
                    <Image src={e.img} alt={`${e.label}, shown as a framed ${e.design} print`} width={900} height={1100} className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]" />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-serif text-xl sm:text-2xl">{e.label}</span>
                    <span className="text-xs text-[#9E968F] whitespace-nowrap">{e.design}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Recording → artwork */}
        <section id="how-it-works" className="bg-[#F1ECE4] py-16 lg:py-24 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-4xl sm:text-5xl max-w-3xl">A fourteen-second voicemail becomes something you can hang.</h2>
            <div className="mt-12 grid md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-12 items-center">
              <div className="flex justify-center">
                <VoiceMemoCard />
              </div>
              <div className="text-center text-3xl text-[#9E968F]" aria-hidden>
                →
              </div>
              <div className="flex justify-center">
                <div className="w-full max-w-[300px] shadow-[0_18px_40px_rgba(40,30,20,.18)]">
                  <Artwork
                    designId={memoriam.id}
                    fields={{ names: "Rose Marie Okafor", date: "1952 — 2025", subtitle: "Voicemail · March 2021", message: "Call me when you get home, sweetheart.", title: "" }}
                    peaks={samplePeaks("voice-memo-demo", "voice")}
                    idPrefix="howto"
                  />
                </div>
              </div>
            </div>
            <ol className="mt-14 grid md:grid-cols-3 gap-8 text-[15px] leading-relaxed">
              <li>
                <div className="font-mono text-xs text-[#9E968F]">01</div>
                <div className="mt-2 font-serif text-2xl">Pick a finished design</div>
                <p className="mt-2 text-[#4A453F]">Five designs, each complete — typeface, layout and colour already decided. No borders or clip art to assemble.</p>
              </li>
              <li>
                <div className="font-mono text-xs text-[#9E968F]">02</div>
                <div className="mt-2 font-serif text-2xl">Add the sound and your words</div>
                <p className="mt-2 text-[#4A453F]">Upload a file or record in the browser. The preview redraws from your actual recording, and it&apos;s exactly what we print.</p>
              </li>
              <li>
                <div className="font-mono text-xs text-[#9E968F]">03</div>
                <div className="mt-2 font-serif text-2xl">We print, frame and ship</div>
                <p className="mt-2 text-[#4A453F]">Made to order in 3–5 business days on archival paper, framed if you like, and shipped free with tracking.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* Designs */}
        <section className="py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <h2 className="font-serif text-4xl sm:text-5xl">Five designs. All of them finished.</h2>
              <Link href="/designs" className="text-sm underline underline-offset-4">
                About the designs
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-5">
              {DESIGNS.map((d) => (
                <Link key={d.id} href={`/create?design=${d.id}`} className="group">
                  <Image src={`/mockups/wall-${d.id}.jpg`} alt={`${d.name} design on a wall`} width={1000} height={1200} className="w-full h-auto" />
                  <div className="mt-3 font-serif text-xl">{d.name}</div>
                  <p className="text-sm text-[#6B655F] leading-snug mt-1">{d.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Scan to listen */}
        <section className="border-t border-[#E6DFD6] py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl">Scan it, and you hear them again.</h2>
              <p className="mt-5 text-[#4A453F] text-lg leading-relaxed">
                Every print can carry a small code in the corner. Point any phone camera at it and the recording plays — no app, no account. The page is private to whoever has the print or the link.
              </p>
              <p className="mt-4 text-sm text-[#7A736B]">Prefer the art on its own? Switch the code off in the studio.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="shadow-[0_14px_30px_rgba(40,30,20,.15)]">
                <Artwork designId="night-of" fields={getDesign("night-of")!.sample} idPrefix="qr1" />
              </div>
              <div className="rounded-[28px] border-[6px] border-[#2D2A26] bg-white p-4 aspect-[9/17] flex flex-col justify-end">
                <div className="text-[11px] text-[#9E968F]">soundwaveart.com</div>
                <div className="font-serif text-lg leading-tight mt-1">Emma &amp; James</div>
                <div className="mt-3 h-1.5 rounded-full bg-[#E6DFD6] overflow-hidden">
                  <div className="h-full w-2/5 bg-[#2D2A26]" />
                </div>
                <div className="mt-2 text-[10px] text-[#9E968F] flex justify-between">
                  <span>1:12</span>
                  <span>2:59</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Details & prices */}
        <section className="bg-[#F1ECE4] py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="font-serif text-4xl sm:text-5xl">Sizes and prices</h2>
              <table className="mt-8 w-full text-left text-[15px]">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.14em] text-[#7A736B]">
                    <th className="py-2 font-normal">Size</th>
                    <th className="py-2 font-normal">Print</th>
                    <th className="py-2 font-normal">Framed</th>
                  </tr>
                </thead>
                <tbody>
                  {PRINT_SIZES.map((s) => (
                    <tr key={s.id} className="border-t border-[#DDD5CB]">
                      <td className="py-3">
                        {s.label} <span className="text-xs text-[#9E968F]">· {s.note}</span>
                      </td>
                      <td className="py-3">{formatPrice(s.price.print)}</td>
                      <td className="py-3">{formatPrice(s.price.framed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-sm text-[#7A736B]">Free tracked shipping in the US. Frames in black, natural oak or white.</p>
            </div>
            <div className="space-y-6 text-[15px] leading-relaxed">
              <div>
                <div className="font-serif text-2xl">Made to order</div>
                <p className="mt-1 text-[#4A453F]">Pigment inks on archival matte fine-art paper. Solid wood frames with a white mount and shatterproof acrylic, ready to hang.</p>
              </div>
              <div>
                <div className="font-serif text-2xl">Delivery</div>
                <p className="mt-1 text-[#4A453F]">Printed in 3–5 business days, then tracked delivery — usually 5–9 business days in total. Order by December 10 for Christmas.</p>
              </div>
              <div>
                <div className="font-serif text-2xl">Our promise</div>
                <p className="mt-1 text-[#4A453F]">If it arrives damaged or doesn&apos;t match your preview, we reprint it free. Just send a photo.</p>
              </div>
            </div>
          </div>
        </section>

        <Testimonials />
        <FAQ />

        <section className="py-20 text-center">
          <h2 className="font-serif text-4xl sm:text-5xl px-4">Start with the recording you already have.</h2>
          <Link href="/create" className="mt-8 inline-block px-8 py-4 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm tracking-wide">
            Create yours
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
