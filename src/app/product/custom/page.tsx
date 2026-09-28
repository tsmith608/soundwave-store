"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PortraitBuilder from "@/components/PortraitBuilder";
import FadeIn from "@/components/motion/FadeIn";
import { Sparkles, ShieldCheck, Truck, Music, Award } from "lucide-react";

function CustomizerStudioInner() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template") || undefined;
  const paletteParam = searchParams.get("palette") || undefined;
  const sizeParam = searchParams.get("size") || undefined;
  const captionParam = searchParams.get("caption") || undefined;

  return (
    <PortraitBuilder
      initialTemplate={templateParam}
      initialPalette={paletteParam}
      initialSize={sizeParam}
      initialCaption={captionParam}
    />
  );
}

function CustomizerLoadingFallback() {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full border-2 border-[#B76E79] border-t-transparent animate-spin mb-4" />
      <p className="text-sm font-medium text-[#6B655F]">Loading Bespoke Customizer Studio...</p>
    </div>
  );
}

export default function CustomProductPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />

      <main className="flex-1">
        {/* Studio Editorial Banner */}
        <section className="pt-10 pb-6 border-b border-[#EAE3DC] bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn direction="up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#EAE3DC] text-xs text-[#6B655F] mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-[#B76E79]" />
                    <span>Bespoke Customizer Studio</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight text-[#2D2A26]">
                    Compose Your{" "}
                    <span className="rosegold-gradient-text italic">Acoustic Portrait</span>
                  </h1>
                  <p className="text-sm sm:text-base text-[#6B655F] max-w-2xl mt-2 font-light">
                    Upload your photograph and audio — then watch the soundwave render live. Adjust the palette, border style, and inscription until the moment is exactly right. Then let us handle the rest.
                  </p>
                </div>

                {/* Studio trust markers */}
                <div className="hidden lg:flex items-center gap-6 text-xs text-[#6B655F]">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#B76E79]" />
                    <span>300 DPI Archival Rag</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#B76E79]" />
                    <span>Handmade Solid Wood</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#B76E79]" />
                    <span>Free US Delivery</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Customizer Studio Content */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<CustomizerLoadingFallback />}>
              <CustomizerStudioInner />
            </Suspense>
          </div>
        </section>

        {/* Studio Craftsmanship Specifications */}
        <section className="py-16 bg-[#F4EFEB] border-t border-[#EAE3DC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn direction="up">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-serif text-2xl sm:text-3xl text-[#2D2A26]">
                  The Anatomy of an Archival Keepsake
                </h2>
                <p className="text-xs sm:text-sm text-[#6B655F] mt-2">
                  Every print is prepared with museum-grade precision, hand-assembled by master framers, and individually inspected.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#2D2A26] mb-2">
                    Museum-Grade Archival Rag
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6B655F] leading-relaxed">
                    240+ GSM heavyweight 100% cotton fine art paper with an acid-free barrier, preserving deep contrast and vivid tone for over a century without yellowing.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                    <Music className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#2D2A26] mb-2">
                    Acoustic Precision & Scannable QR
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6B655F] leading-relaxed">
                    Audio waveforms are mathematically sampled across 80 dynamic frequency bands. Each print features a discreet scannable QR badge linked to your original audio recording.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-[#EAE3DC] shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center text-[#B76E79] mb-4">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#2D2A26] mb-2">
                    Solid Hardwood & Optical Acrylic
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6B655F] leading-relaxed">
                    Sustainably harvested Appalachian hardwood frames fitted with shatter-resistant optical grade acrylic that filters 90% of harmful UV rays.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
