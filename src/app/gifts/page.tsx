import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAnniversaryOccasions, getMemorialOccasions } from "@/lib/pseo";
import { Sparkles, Heart, ArrowRight, Star, Clock, Gift, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Occasion Soundwave Art Gifts | Anniversaries, Memorials & Keepsakes",
  description:
    "Explore bespoke acoustic soundwave gifts tailored for every milestone. Traditional anniversary materials (Years 1–60), pet memorials, celebration of life, and wedding keepsakes.",
  keywords: [
    "occasion soundwave art",
    "anniversary gifts by year",
    "traditional anniversary materials",
    "memorial soundwave art",
    "custom soundwave gifts",
    "wedding vow art",
  ],
  openGraph: {
    title: "Occasion Soundwave Art Gifts | SoundWave Art",
    description:
      "Explore bespoke acoustic soundwave gifts tailored for every milestone. Traditional anniversary materials, pet memorials, and wedding keepsakes.",
    type: "website",
  },
};

export default function GiftsCatalogPage() {
  const anniversaries = getAnniversaryOccasions();
  const memorials = getMemorialOccasions();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />

      <main className="flex-1">
        {/* Editorial Header */}
        <section className="pt-12 pb-10 border-b border-[#EAE3DC] bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-[#EAE3DC] text-xs font-semibold text-[#B76E79] mb-4 shadow-sm">
              <Gift className="w-3.5 h-3.5" />
              <span>Programmatic Occasions Engine</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif tracking-tight text-[#2D2A26]">
              Milestone & Keepsake <span className="rosegold-gradient-text italic">Gift Catalog</span>
            </h1>

            <p className="text-sm sm:text-base text-[#6B655F] max-w-2xl mx-auto mt-3 font-light leading-relaxed">
              Every momentous chapter has an unmistakable sound. Explore our curated collections matching traditional anniversary milestones and poignant keepsakes, handcrafted on 100% cotton archival rag.
            </p>

            {/* Quick Filter Anchors */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#anniversaries"
                className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider bg-white border border-[#EAE3DC] hover:border-[#B76E79] hover:text-[#B76E79] transition-colors shadow-sm"
              >
                Anniversaries by Year ({anniversaries.length})
              </a>
              <a
                href="#memorials"
                className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider bg-white border border-[#EAE3DC] hover:border-[#B76E79] hover:text-[#B76E79] transition-colors shadow-sm"
              >
                Memorials & Keepsakes ({memorials.length})
              </a>
              <Link
                href="/product/custom"
                className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#B76E79] text-white hover:bg-[#A05C66] transition-colors shadow-sm"
              >
                Open Studio Studio →
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1: Traditional Anniversaries by Year */}
        <section id="anniversaries" className="py-16 border-b border-[#EAE3DC] bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
              <div>
                <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79]">
                  Engine 1: Traditional Materials
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2D2A26] mt-1">
                  Wedding Anniversaries by Milestone Year
                </h2>
                <p className="text-xs sm:text-sm text-[#6B655F] mt-1">
                  From Year 1 (Paper) to Year 60 (Diamond Jubilee), honoring centuries-old gifting traditions.
                </p>
              </div>

              <span className="text-xs text-[#9E968F] mt-2 md:mt-0 font-mono">
                {anniversaries.length} Milestones Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {anniversaries.map((occ) => {
                const customizerUrl = `/product/custom?template=${encodeURIComponent(
                  occ.recommendedTemplate
                )}&palette=${encodeURIComponent(occ.recommendedPalette)}&size=${encodeURIComponent(
                  occ.recommendedSize
                )}&caption=${encodeURIComponent(occ.sampleCaption)}`;

                return (
                  <div
                    key={occ.id}
                    className="bg-white rounded-2xl border border-[#EAE3DC] p-6 shadow-sm hover:shadow-md transition-all hover:border-[#B76E79] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE3DC] text-[11px] font-bold text-[#B76E79]">
                          Year {occ.milestoneYear}
                        </span>
                        {occ.traditionalMaterial && (
                          <span className="text-[11px] font-medium text-[#6B655F]">
                            Material: <strong className="text-[#2D2A26]">{occ.traditionalMaterial}</strong>
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#2D2A26] group-hover:text-[#B76E79] transition-colors leading-snug">
                        <Link href={`/gifts/${occ.slug}`}>{occ.title}</Link>
                      </h3>

                      <p className="text-xs text-[#6B655F] mt-2 line-clamp-2 leading-relaxed">
                        {occ.emotionalHook}
                      </p>

                      <div className="mt-4 pt-3 border-t border-[#EAE3DC]/70 flex items-center justify-between text-xs text-[#9E968F]">
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-[#2D2A26]">{occ.ratingValue}</span>
                          <span className="text-[#9E968F] font-normal">({occ.reviewCount})</span>
                        </span>
                        <span className="font-mono text-[#2D2A26] font-bold">From $49</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#EAE3DC] flex items-center gap-2">
                      <Link
                        href={`/gifts/${occ.slug}`}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-center bg-[#FAF7F2] hover:bg-[#EAE3DC] text-[#2D2A26] transition-colors"
                      >
                        View Details
                      </Link>
                      <Link
                        href={customizerUrl}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-center bg-[#B76E79] hover:bg-[#A05C66] text-white transition-colors"
                        title="Customize with pre-hydrated settings"
                      >
                        Customize →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: Memorial & Keepsake Moments */}
        <section id="memorials" className="py-16 bg-white border-b border-[#EAE3DC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
              <div>
                <span className="text-xs uppercase tracking-widest font-mono font-semibold text-[#B76E79]">
                  Engine 2: Emotional Keepsakes
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#2D2A26] mt-1">
                  Memorial & Cherished Life Moments
                </h2>
                <p className="text-xs sm:text-sm text-[#6B655F] mt-1">
                  Preserving precious voices, heartbeats, wedding vows, and unscripted laughter.
                </p>
              </div>

              <span className="text-xs text-[#9E968F] mt-2 md:mt-0 font-mono">
                {memorials.length} Keepsakes Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {memorials.map((occ) => {
                const customizerUrl = `/product/custom?template=${encodeURIComponent(
                  occ.recommendedTemplate
                )}&palette=${encodeURIComponent(occ.recommendedPalette)}&size=${encodeURIComponent(
                  occ.recommendedSize
                )}&caption=${encodeURIComponent(occ.sampleCaption)}`;

                return (
                  <div
                    key={occ.id}
                    className="bg-[#FAF7F2] rounded-2xl border border-[#EAE3DC] p-6 shadow-sm hover:shadow-md transition-all hover:border-[#B76E79] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#EAE3DC] text-[11px] font-bold text-[#B76E79] flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {occ.badge}
                        </span>
                        <span className="text-[11px] font-medium text-emerald-600">
                          ✓ Archival Cotton
                        </span>
                      </div>

                      <h3 className="font-serif text-xl font-bold text-[#2D2A26] group-hover:text-[#B76E79] transition-colors leading-snug">
                        <Link href={`/gifts/${occ.slug}`}>{occ.title}</Link>
                      </h3>

                      <p className="text-xs text-[#6B655F] mt-2 line-clamp-2 leading-relaxed">
                        {occ.emotionalHook}
                      </p>

                      <div className="mt-4 pt-3 border-t border-[#EAE3DC]/70 flex items-center justify-between text-xs text-[#9E968F]">
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-[#2D2A26]">{occ.ratingValue}</span>
                          <span className="text-[#9E968F] font-normal">({occ.reviewCount})</span>
                        </span>
                        <span className="font-mono text-[#2D2A26] font-bold">From $49</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#EAE3DC] flex items-center gap-2">
                      <Link
                        href={`/gifts/${occ.slug}`}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-center bg-white hover:bg-[#FAF7F2] border border-[#EAE3DC] text-[#2D2A26] transition-colors"
                      >
                        View Details
                      </Link>
                      <Link
                        href={customizerUrl}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-center bg-[#B76E79] hover:bg-[#A05C66] text-white transition-colors"
                        title="Customize with pre-hydrated settings"
                      >
                        Customize →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global Assurance Banner */}
        <section className="py-16 bg-[#F4EFEB] border-t border-[#EAE3DC]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="font-serif text-2xl sm:text-3xl text-[#2D2A26]">
              Every Acoustic Portrait Includes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
              <div className="bg-white p-5 rounded-xl border border-[#EAE3DC] text-center">
                <ShieldCheck className="w-6 h-6 text-[#B76E79] mx-auto mb-2" />
                <h4 className="font-serif font-bold text-sm text-[#2D2A26]">100% Archival Cotton Rag</h4>
                <p className="text-xs text-[#6B655F] mt-1">240+ GSM acid-free museum fine art paper guaranteed for 100+ years.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#EAE3DC] text-center">
                <Sparkles className="w-6 h-6 text-[#B76E79] mx-auto mb-2" />
                <h4 className="font-serif font-bold text-sm text-[#2D2A26]">Solid Appalachian Hardwood</h4>
                <p className="text-xs text-[#6B655F] mt-1">Sustainably harvested real solid wood with optical grade UV acrylic.</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#EAE3DC] text-center">
                <Clock className="w-6 h-6 text-[#B76E79] mx-auto mb-2" />
                <h4 className="font-serif font-bold text-sm text-[#2D2A26]">Discreet Scannable Audio QR</h4>
                <p className="text-xs text-[#6B655F] mt-1">Scan with any smartphone camera to stream the original sound recording.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
