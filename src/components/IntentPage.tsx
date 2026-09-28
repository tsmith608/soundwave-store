import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FramedArtwork from "@/components/art/FramedArtwork";
import { getDesign, samplePeaks, type ArtFields } from "@/lib/art";
import { PRINT_SIZES, formatPrice } from "@/lib/catalog";

export interface IntentExample {
  designId: string;
  colorwayId?: string;
  fields: ArtFields;
  kind: "voice" | "song" | "heartbeat";
  seed: string;
  caption: string;
  frame?: string;
}

export interface IntentContent {
  eyebrow: string;
  h1: string;
  intro: string[];
  occasion: string;
  examples: IntentExample[];
  howToTitle: string;
  howTo: { title: string; body: string }[];
  considerations: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  ctaLabel: string;
}

/**
 * Template for search-intent landing pages. Each page supplies its own copy,
 * examples and FAQs — the template only handles layout — so pages are
 * genuinely different documents rather than keyword-swapped doorways.
 */
export default function IntentPage({ c }: { c: IntentContent }) {
  const fromPrint = Math.min(...PRINT_SIZES.map((s) => s.price.print));
  const fromFramed = Math.min(...PRINT_SIZES.map((s) => s.price.framed));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7A736B]">{c.eyebrow}</p>
            <h1 className="mt-4 font-serif text-5xl sm:text-6xl leading-[1.03] tracking-tight">{c.h1}</h1>
            {c.intro.map((p, i) => (
              <p key={i} className="mt-5 text-lg text-[#4A453F] leading-relaxed">
                {p}
              </p>
            ))}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={`/create?occasion=${c.occasion}`} className="px-7 py-3.5 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm">
                {c.ctaLabel}
              </Link>
              <span className="text-sm text-[#7A736B]">
                Prints from {formatPrice(fromPrint)} · framed from {formatPrice(fromFramed)}
              </span>
            </div>
          </div>
          <div className="bg-[#EDE8E1] px-[12%] py-[9%]">
            {(() => {
              const e = c.examples[0];
              return (
                <FramedArtwork designId={e.designId} colorwayId={e.colorwayId} fields={e.fields} peaks={samplePeaks(e.seed, e.kind)} frameFinish={e.frame ?? "black"} idPrefix="intent-hero" />
              );
            })()}
          </div>
        </section>

        {c.examples.length > 1 && (
          <section className="border-t border-[#E6DFD6] py-14">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="font-serif text-3xl sm:text-4xl">Examples</h2>
              <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {c.examples.slice(1).map((e, i) => (
                  <figure key={i}>
                    <div className="bg-[#EDE8E1] px-[14%] py-[10%]">
                      <FramedArtwork designId={e.designId} colorwayId={e.colorwayId} fields={e.fields} peaks={samplePeaks(e.seed, e.kind)} frameFinish={e.frame ?? "black"} idPrefix={`intent-${i}`} />
                    </div>
                    <figcaption className="mt-3 text-sm text-[#4A453F]">
                      <span className="font-medium">{getDesign(e.designId)?.name}</span> — {e.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="bg-[#F1ECE4] py-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl sm:text-4xl">{c.howToTitle}</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-8">
              {c.howTo.map((h, i) => (
                <div key={i}>
                  <div className="font-mono text-xs text-[#9E968F]">0{i + 1}</div>
                  <div className="mt-2 font-serif text-2xl">{h.title}</div>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A453F]">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl sm:text-4xl">Before you order</h2>
            <dl className="mt-6 space-y-6">
              {c.considerations.map((k, i) => (
                <div key={i}>
                  <dt className="font-medium">{k.title}</dt>
                  <dd className="mt-1 text-[#4A453F] leading-relaxed">{k.body}</dd>
                </div>
              ))}
            </dl>
            <h2 className="mt-14 font-serif text-3xl sm:text-4xl">Questions</h2>
            <dl className="mt-6 space-y-6">
              {c.faqs.map((f, i) => (
                <div key={i}>
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="mt-1 text-[#4A453F] leading-relaxed">{f.a}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-12">
              <Link href={`/create?occasion=${c.occasion}`} className="inline-block px-7 py-3.5 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm">
                {c.ctaLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
