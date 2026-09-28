import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WaveformCanvas from "@/components/WaveformCanvas";
import { PALETTES, FRAME_SIZES, DECORATIVE_STYLES } from "@/lib/constants";
import { getAllOccasions, getOccasionBySlug } from "@/lib/pseo";
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Music,
  Award,
  CheckCircle2,
  ArrowRight,
  Heart,
  Volume2,
  HelpCircle,
  Layers,
  Star,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const occasions = getAllOccasions();
  return occasions.map((occ) => ({
    slug: occ.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const occasion = getOccasionBySlug(slug);

  if (!occasion) {
    return {
      title: "Custom Acoustic Gift | SoundWave Art",
      description: "Personalized acoustic soundwave art prints handcrafted in solid hardwood.",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://soundwaveart.com";
  const canonicalUrl = `${appUrl}/gifts/${occasion.slug}`;

  return {
    title: `${occasion.metaTitle} | SoundWave Art`,
    description: occasion.metaDescription,
    keywords: occasion.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: occasion.metaTitle,
      description: occasion.metaDescription,
      url: canonicalUrl,
      type: "website",
      siteName: "SoundWave Art",
      images: [
        {
          url: `${appUrl}/api/og?title=${encodeURIComponent(occasion.title)}`,
          width: 1200,
          height: 630,
          alt: occasion.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: occasion.metaTitle,
      description: occasion.metaDescription,
      images: [`${appUrl}/api/og?title=${encodeURIComponent(occasion.title)}`],
    },
  };
}

export default async function GiftOccasionPage({ params }: PageProps) {
  const { slug } = await params;
  const occasion = getOccasionBySlug(slug);

  if (!occasion) {
    notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://soundwaveart.com";
  const pageUrl = `${appUrl}/gifts/${occasion.slug}`;

  const palette = PALETTES[occasion.recommendedPalette] || PALETTES["midnight_gold"];
  const styleConfig = DECORATIVE_STYLES[occasion.recommendedTemplate] || DECORATIVE_STYLES["botanical"];
  const sizeConfig = FRAME_SIZES[occasion.recommendedSize] || FRAME_SIZES["16x20"];

  const customizerUrl = `/product/custom?template=${encodeURIComponent(
    occasion.recommendedTemplate
  )}&palette=${encodeURIComponent(occasion.recommendedPalette)}&size=${encodeURIComponent(
    occasion.recommendedSize
  )}&caption=${encodeURIComponent(occasion.sampleCaption)}`;

  // Schema.org Unified @graph JSON-LD
  const schemaGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${pageUrl}#product`,
        name: occasion.title,
        description: occasion.metaDescription,
        brand: {
          "@type": "Brand",
          name: "SoundWave Art",
        },
        category:
          occasion.engine === "anniversary" ? "Anniversary Gifts" : "Memorial & Keepsake Gifts",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "49.00",
          highPrice: "149.00",
          offerCount: "4",
          availability: "https://schema.org/InStock",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: occasion.ratingValue,
          reviewCount: occasion.reviewCount.toString(),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: appUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Occasion Gifts",
            item: `${appUrl}/gifts`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: occasion.title,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: occasion.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
      />

      <Navbar />

      <main className="flex-1">
        {/* Breadcrumb Bar */}
        <section className="border-b border-[#EAE3DC] bg-[#FAF7F2]/60 py-3 text-xs text-[#6B655F]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2">
            <Link href="/" className="hover:text-[#2D2A26] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/gifts" className="hover:text-[#2D2A26] transition-colors">
              Occasions
            </Link>
            <span>/</span>
            <span className="text-[#2D2A26] font-medium truncate">{occasion.title}</span>
          </div>
        </section>

        {/* Hero Section */}
        <section className="pt-10 pb-16 border-b border-[#EAE3DC] bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Copy & Narrative */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#EAE3DC] text-xs font-semibold text-[#B76E79]">
                    <Sparkles className="w-3.5 h-3.5" />
                    {occasion.badge}
                  </span>
                  {occasion.traditionalMaterial && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAE3DC]/60 text-xs text-[#6B655F]">
                      Traditional: <strong className="text-[#2D2A26]">{occasion.traditionalMaterial}</strong>
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-xs text-[#9E968F]">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="font-semibold text-[#2D2A26] ml-1">{occasion.ratingValue}</span>
                    <span>({occasion.reviewCount} reviews)</span>
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight text-[#2D2A26] leading-tight">
                  {occasion.title}
                </h1>

                <p className="text-lg sm:text-xl text-[#B76E79] font-serif italic mt-2">
                  {occasion.subtitle}
                </p>

                <p className="text-sm sm:text-base text-[#6B655F] mt-4 leading-relaxed">
                  {occasion.emotionalHook}
                </p>

                <div className="mt-6 p-4 rounded-xl bg-white border border-[#EAE3DC] shadow-sm">
                  <div className="flex items-start gap-3">
                    <Heart className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
                    <div>
                      <h2 className="text-xs uppercase tracking-wider font-bold text-[#2D2A26] mb-1">
                        The Meaning Behind This Moment
                      </h2>
                      <p className="text-xs sm:text-sm text-[#6B655F] leading-relaxed">
                        {occasion.symbolism}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sound ideas badge list */}
                <div className="mt-6">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#9E968F] flex items-center gap-1.5 mb-2">
                    <Volume2 className="w-4 h-4 text-[#B76E79]" />
                    Recommended Audio Ideas:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {occasion.audioIdeas.map((idea, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-[#6B655F] bg-[#FAF7F2] border border-[#EAE3DC] px-3 py-1.5 rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#B76E79] flex-shrink-0" />
                        <span className="truncate">{idea}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary CTA Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Link
                    href={customizerUrl}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm uppercase font-bold tracking-wider bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-md transition-all hover:scale-[1.02] text-center"
                  >
                    <span>Customize This Portrait</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <div className="text-center sm:text-left">
                    <span className="text-xs text-[#6B655F] block">
                      Pre-hydrated with <strong className="text-[#2D2A26]">{styleConfig.name}</strong> &{" "}
                      <strong className="text-[#2D2A26]">{palette.name}</strong>
                    </span>
                    <span className="text-[11px] text-[#9E968F]">
                      Starting from $49 · Free US Shipping
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Waveform Canvas Preview */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-md bg-white p-6 rounded-3xl border border-[#EAE3DC] shadow-xl relative group">
                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-[#EAE3DC] text-[10px] uppercase font-mono font-bold tracking-wider text-[#B76E79] shadow-sm">
                      Live Preview
                    </span>
                  </div>

                  {/* Frame rendering */}
                  <div className="w-full aspect-[4/5] bg-[#FAF7F2] rounded-2xl overflow-hidden border-8 border-[#2D2A26] shadow-inner relative flex items-center justify-center p-2">
                    <WaveformCanvas
                      palette={palette}
                      caption={occasion.sampleCaption}
                      decorativeStyle={occasion.recommendedTemplate}
                      previewMode={true}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Frame metadata bar */}
                  <div className="mt-4 pt-4 border-t border-[#EAE3DC] flex items-center justify-between text-xs text-[#6B655F]">
                    <div>
                      <span className="font-serif font-bold text-[#2D2A26] block">
                        {sizeConfig.name}
                      </span>
                      <span className="text-[11px] text-[#9E968F]">
                        Style: {styleConfig.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#2D2A26] text-sm block">
                        {sizeConfig.priceFormatted}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        ✓ In Stock & Ready to Frame
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rich Editorial Story Section */}
        <section className="py-16 bg-white border-b border-[#EAE3DC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79]">
              The Acoustic Keepsake Story
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2D2A26] mt-2 mb-6">
              Why Spoken Frequencies Matter
            </h2>
            <div className="text-left bg-[#FAF7F2] p-8 sm:p-10 rounded-3xl border border-[#EAE3DC] leading-relaxed text-[#2D2A26] space-y-4 text-sm sm:text-base">
              <p>{occasion.storyCopy}</p>
              <div className="pt-4 border-t border-[#EAE3DC] flex items-center justify-between text-xs text-[#6B655F]">
                <span>Sample Inscription: <em>&ldquo;{occasion.sampleCaption}&rdquo;</em></span>
                <span className="font-mono text-[10px] text-[#9E968F]">100% Archival Rag</span>
              </div>
            </div>
          </div>
        </section>

        {/* Museum Craftsmanship Standards */}
        <section className="py-16 bg-[#FAF7F2] border-b border-[#EAE3DC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79]">
                Uncompromising Quality
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2D2A26] mt-1">
                The Anatomy of an Archival Keepsake
              </h2>
              <p className="text-xs sm:text-sm text-[#6B655F] mt-2">
                Every custom portrait is handcrafted in the United States and inspected under precision optical standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#2D2A26] mb-1">
                  100% Cotton Rag Paper
                </h3>
                <p className="text-xs text-[#6B655F] leading-relaxed">
                  240+ GSM heavyweight museum fine-art paper, acid-free to prevent yellowing or fading for over 100 years.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#2D2A26] mb-1">
                  Solid Appalachian Wood
                </h3>
                <p className="text-xs text-[#6B655F] leading-relaxed">
                  Handcrafted from sustainably sourced solid hardwood with optical UV-filtering acrylic shielding.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                  <Music className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#2D2A26] mb-1">
                  Scannable Audio QR
                </h3>
                <p className="text-xs text-[#6B655F] leading-relaxed">
                  Every print features a subtle scannable QR badge. Point your phone camera to stream original audio instantly.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#2D2A26] mb-1">
                  Free Insured Delivery
                </h3>
                <p className="text-xs text-[#6B655F] leading-relaxed">
                  Ships securely encased in reinforced gallery packaging with 100% loss and transit damage protection.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & Dimensions Grid */}
        <section className="py-16 bg-white border-b border-[#EAE3DC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79]">
                Dimensions & Formats
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2D2A26] mt-1">
                Select Your Frame Size
              </h2>
              <p className="text-xs sm:text-sm text-[#6B655F] mt-2">
                All formats arrive fully assembled, framed in solid wood, and ready to hang.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(FRAME_SIZES).map(([sizeKey, config]) => {
                const isRecommended = sizeKey === occasion.recommendedSize;
                const sizeUrl = `/product/custom?template=${encodeURIComponent(
                  occasion.recommendedTemplate
                )}&palette=${encodeURIComponent(occasion.recommendedPalette)}&size=${sizeKey}&caption=${encodeURIComponent(
                  occasion.sampleCaption
                )}`;

                return (
                  <div
                    key={sizeKey}
                    className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                      isRecommended
                        ? "bg-[#FAF7F2] border-[#B76E79] shadow-md ring-1 ring-[#B76E79]"
                        : "bg-white border-[#EAE3DC] hover:border-[#9E968F]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs uppercase text-[#9E968F]">
                          {config.dimensions}
                        </span>
                        {isRecommended && (
                          <span className="px-2 py-0.5 rounded-full bg-[#B76E79] text-white text-[10px] font-bold uppercase tracking-wider">
                            Recommended
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#2D2A26]">
                        {config.name}
                      </h3>

                      <div className="my-4">
                        <span className="font-mono text-2xl font-bold text-[#2D2A26]">
                          {config.priceFormatted}
                        </span>
                        <span className="text-xs text-[#6B655F] ml-1">USD</span>
                      </div>

                      <ul className="space-y-2 text-xs text-[#6B655F] mb-6">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#B76E79]" />
                          <span>Museum cotton rag print</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#B76E79]" />
                          <span>Handmade solid wood frame</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#B76E79]" />
                          <span>Discreet audio QR badge</span>
                        </li>
                      </ul>
                    </div>

                    <Link
                      href={sizeUrl}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all ${
                        isRecommended
                          ? "bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-sm"
                          : "bg-white border border-[#EAE3DC] hover:bg-[#FAF7F2] text-[#2D2A26]"
                      }`}
                    >
                      Choose {config.dimensions}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section (Native HTML details for 100% crawlable SEO) */}
        <section className="py-16 bg-[#FAF7F2] border-b border-[#EAE3DC]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79] flex items-center justify-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                Frequently Asked Questions
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#2D2A26] mt-1">
                Everything You Need to Know
              </h2>
            </div>

            <div className="space-y-4">
              {occasion.faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-white rounded-2xl border border-[#EAE3DC] p-5 [&_summary::-webkit-details-marker]:none transition-all open:shadow-sm"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-serif text-base sm:text-lg font-semibold text-[#2D2A26] select-none">
                    <span>{faq.question}</span>
                    <span className="text-[#B76E79] text-xl font-light transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-xs sm:text-sm text-[#6B655F] leading-relaxed border-t border-[#EAE3DC] pt-4">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="py-20 bg-gradient-to-b from-[#FAF7F2] to-[#EAE3DC]/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#EAE3DC] mx-auto flex items-center justify-center text-[#B76E79] mb-6 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#2D2A26] tracking-tight">
              Begin Your Custom {occasion.title}
            </h2>
            <p className="text-sm sm:text-base text-[#6B655F] max-w-xl mx-auto mt-3">
              Upload your audio and see your live acoustic waveform rendered in real time. Personalize the inscription and let our master framers create your heirloom.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={customizerUrl}
                className="w-full sm:w-auto px-10 py-4 rounded-xl text-sm uppercase font-bold tracking-wider bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-lg transition-all hover:scale-105"
              >
                Create Your Portrait Now
              </Link>
              <Link
                href="/gifts"
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm uppercase font-semibold tracking-wider bg-white hover:bg-[#FAF7F2] border border-[#EAE3DC] text-[#2D2A26] transition-all"
              >
                Browse All Occasions
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
