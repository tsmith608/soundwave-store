import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FramedArtwork from "@/components/art/FramedArtwork";
import { CTA } from "@/components/brand/Button";
import Reveal from "@/components/brand/Reveal";
import { WaveEdge } from "@/components/brand/shapes";
import { getDesign, samplePeaks, type ArtFields } from "@/lib/art";
import { PRINT_SIZES, formatPrice } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export interface IntentExample {
  designId: string;
  colorwayId?: string;
  fields: ArtFields;
  kind: "voice" | "song" | "heartbeat";
  seed: string;
  caption: string;
  frame?: string;
}

export type World = "paper" | "night" | "botanical" | "romantic" | "film";

export interface IntentContent {
  eyebrow: string;
  h1: string;
  world?: World;
  intro: string[];
  occasion: string;
  examples: IntentExample[];
  howToTitle: string;
  howTo: { title: string; body: string }[];
  considerations: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  ctaLabel: string;
  /** Canonical path, for breadcrumbs. */
  path?: string;
}

const WORLDS: Record<World, { bg: string; text: string; fill: string; dark?: boolean }> = {
  paper: { bg: "bg-paper-2", text: "text-ink", fill: "var(--paper-2)" },
  night: { bg: "bg-night", text: "text-night-ink", fill: "var(--night)", dark: true },
  botanical: { bg: "bg-botanical", text: "text-botanical-ink", fill: "var(--botanical)" },
  romantic: { bg: "bg-romantic", text: "text-romantic-wine", fill: "var(--romantic)" },
  film: { bg: "bg-film", text: "text-ink", fill: "var(--film)" },
};

/**
 * Template for search-intent landing pages. Each page supplies its own copy,
 * examples and FAQs — the template only handles layout — so pages are
 * genuinely different documents rather than keyword-swapped doorways.
 */
export default function IntentPage({ c }: { c: IntentContent }) {
  const w = WORLDS[c.world ?? "paper"];
  const fromPrint = Math.min(...PRINT_SIZES.map((s) => s.price.print));
  const fromFramed = Math.min(...PRINT_SIZES.map((s) => s.price.framed));
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    ...(c.path
      ? [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: c.eyebrow, item: `${SITE_URL}${c.path}` },
            ],
          },
        ]
      : []),
  ];
  const hero = c.examples[0];
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main id="main" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <section className={`${w.bg} ${w.text} ${w.dark ? "on-dark" : ""}`}>
          <nav aria-label="Breadcrumb" className="mx-auto max-w-[1440px] px-4 pt-6 text-sm opacity-75 sm:px-8">
            <Link href="/" className="underline">Home</Link> <span aria-hidden>/</span> <span aria-current="page">{c.eyebrow}</span>
          </nav>
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-16 pt-12 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="meta opacity-75">{c.eyebrow}</p>
              <h1 className="display mt-5 text-[13vw] sm:text-[9vw] lg:text-[96px]">{c.h1}</h1>
              {c.intro.map((p, i) => (
                <p key={i} className="mt-6 max-w-2xl text-lg leading-relaxed opacity-90">
                  {p}
                </p>
              ))}
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <CTA href={`/create?occasion=${c.occasion}`}>{c.ctaLabel}</CTA>
                <span className="meta opacity-75">
                  Prints from {formatPrice(fromPrint)} · framed from {formatPrice(fromFramed)}
                </span>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="mx-auto w-[78%] max-w-[440px] rotate-[1.5deg]">
                <FramedArtwork designId={hero.designId} colorwayId={hero.colorwayId} fields={hero.fields} peaks={samplePeaks(hero.seed, hero.kind)} frameFinish={hero.frame ?? "black"} qrStyle="discreet" idPrefix="intent-hero" />
              </div>
            </div>
          </div>
        </section>
        <WaveEdge seed={`intent-${c.occasion}`} fill={w.fill} flip />

        {c.examples.length > 1 && (
          <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8">
            <p className="meta mb-8">Examples · demo recordings</p>
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {c.examples.slice(1).map((e, i) => (
                <Reveal as="figure" key={i} delay={i * 120}>
                  <div className="bg-paper-2 px-[14%] py-[10%]">
                    <FramedArtwork designId={e.designId} colorwayId={e.colorwayId} fields={e.fields} peaks={samplePeaks(e.seed, e.kind)} frameFinish={e.frame ?? "black"} qrStyle="discreet" idPrefix={`intent-${i}`} />
                  </div>
                  <figcaption className="mt-4">
                    <span className="display text-2xl">{getDesign(e.designId)?.name}</span>
                    <span className="mt-1 block text-ink-soft">{e.caption}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <section className="border-y border-ink/15">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8">
            <h2 className="display text-[11vw] sm:text-[7vw] lg:text-[72px]">{c.howToTitle}</h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-3">
              {c.howTo.map((h, i) => (
                <li key={i} className="border-t border-ink/15 pt-4">
                  <span className="display text-5xl text-signal">{i + 1}</span>
                  <span className="display mt-2 block text-3xl">{h.title}</span>
                  <p className="mt-3 text-lg leading-relaxed text-ink-soft">{h.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-12 px-4 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="display text-5xl sm:text-6xl">Before you order</h2>
            <dl className="mt-8 space-y-6">
              {c.considerations.map((k, i) => (
                <div key={i} className="border-t border-ink/15 pt-3">
                  <dt className="text-xl font-semibold">{k.title}</dt>
                  <dd className="mt-2 text-lg leading-relaxed text-ink-soft">{k.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="display text-5xl sm:text-6xl">Questions</h2>
            <dl className="mt-8 space-y-6">
              {c.faqs.map((f, i) => (
                <div key={i} className="border-t border-ink/15 pt-3">
                  <dt className="text-xl font-semibold">{f.q}</dt>
                  <dd className="mt-2 text-lg leading-relaxed text-ink-soft">{f.a}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-12">
              <CTA href={`/create?occasion=${c.occasion}`}>{c.ctaLabel}</CTA>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
