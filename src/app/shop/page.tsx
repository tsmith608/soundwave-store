"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeIn from "@/components/motion/FadeIn";
import MagneticFrame from "@/components/motion/MagneticFrame";
import StaggerContainer, { StaggerItem } from "@/components/motion/StaggerContainer";
import { FRAME_SIZES, PALETTES, DecorativeStyle } from "@/lib/constants";
import WaveformCanvas from "@/components/WaveformCanvas";
import { Sparkles, ArrowRight, Check, SlidersHorizontal, Maximize2, Shield, Heart } from "lucide-react";

interface CatalogPreset {
  id: string;
  title: string;
  subtitle: string;
  category: "botanical" | "architectural" | "abstract" | "minimal" | "vintage" | "luxury";
  template: string;
  palette: string;
  sampleCaption: string;
  story: string;
  popularSize: string;
  bgGradient: string;
  waveColor: string;
  accentBorder: string;
}

const PRESET_CATALOG: CatalogPreset[] = [
  {
    id: "botanical-heirloom",
    title: "Botanical Heirloom",
    subtitle: "Organic Biophilic Eucalyptus",
    category: "botanical",
    template: "botanical",
    palette: "sage_cream",
    sampleCaption: "First Heartbeat — 142 BPM — August 14, 2025",
    story: "Hand-drawn eucalyptus fronds framing ultrasound echoes in earthy sage.",
    popularSize: "11x14",
    bgGradient: "from-[#FDFBF7] to-[#F2EFE9]",
    waveColor: "#738671",
    accentBorder: "border-[#738671]/20",
  },
  {
    id: "modern-exhibition",
    title: "Bauhaus Modern Gallery",
    subtitle: "Contemporary Double Hairline",
    category: "abstract",
    template: "modern_border",
    palette: "nordic_slate",
    sampleCaption: "Our First Dance — At Last — June 20, 2024",
    story: "Precision dual borders with architectural corner crosshairs on slate.",
    popularSize: "16x20",
    bgGradient: "from-[#222222] to-[#141414]",
    waveColor: "#fdfdfd",
    accentBorder: "border-white/20",
  },
  {
    id: "parisian-arch",
    title: "Architectural Arch",
    subtitle: "Classical Parisian Vault",
    category: "architectural",
    template: "arch",
    palette: "warm_sand",
    sampleCaption: "Parisian Vows — Sacré-Cœur — Autumn",
    story: "Neoclassical curvature enveloping vows with warm terracotta tones.",
    popularSize: "16x20",
    bgGradient: "from-[#F8F5EE] to-[#EFE8DC]",
    waveColor: "#A67C52",
    accentBorder: "border-[#A67C52]/20",
  },
  {
    id: "art-deco-noir",
    title: "Art Deco Noir",
    subtitle: "Gatsby Era Stepped Chevron",
    category: "luxury",
    template: "art_deco",
    palette: "midnight_gold",
    sampleCaption: "Rhapsody in Blue — Lincoln Center — 2026",
    story: "Radiating sunburst angles and metallic gold accents on deep obsidian.",
    popularSize: "24x36",
    bgGradient: "from-[#111111] to-[#050505]",
    waveColor: "#d4af37",
    accentBorder: "border-[#d4af37]/30",
  },
  {
    id: "celestial-stars",
    title: "Celestial Constellation",
    subtitle: "Starlight Compass & Crescent Moon",
    category: "vintage",
    template: "celestial",
    palette: "dark_blue_white",
    sampleCaption: "Written in the Stars — Under the Tahoe Sky",
    story: "Eight-point compass starbursts celebrating evening vows and cosmic moments.",
    popularSize: "16x20",
    bgGradient: "from-[#0d2142] to-[#071326]",
    waveColor: "#ffffff",
    accentBorder: "border-white/20",
  },
  {
    id: "clean-nordic",
    title: "Nordic Minimalist",
    subtitle: "Pure Archival White Space",
    category: "minimal",
    template: "minimal",
    palette: "white_silver",
    sampleCaption: "The Voicemail I Never Deleted — Always",
    story: "Generous unadorned archival matting allowing raw soundwaves to breathe.",
    popularSize: "8x10",
    bgGradient: "from-[#FFFFFF] to-[#F5F5F5]",
    waveColor: "#808080",
    accentBorder: "border-[#E5E5E5]",
  },
  {
    id: "carrara-vein",
    title: "Carrara Luxury Marble",
    subtitle: "Editorial Stone Vein & Brass Inset",
    category: "luxury",
    template: "luxury_marble",
    palette: "blush_rosegold",
    sampleCaption: "To Love & To Cherish — Forever & A Day",
    story: "Subtle organic veining paired with blush rose gold metallic accents.",
    popularSize: "16x20",
    bgGradient: "from-[#FAF7F2] to-[#F3ECE4]",
    waveColor: "#B76E79",
    accentBorder: "border-[#B76E79]/20",
  },
  {
    id: "abstract-geometric",
    title: "Mid-Century Geometric",
    subtitle: "Asymmetrical Rectilinear Lines",
    category: "abstract",
    template: "abstract_geometric",
    palette: "nordic_slate",
    sampleCaption: "Kind of Blue — Miles Davis — 1959",
    story: "De Stijl and Bauhaus inspired framing lines for contemporary spaces.",
    popularSize: "24x36",
    bgGradient: "from-[#1c1c1c] to-[#0f0f0f]",
    waveColor: "#d8c7b5",
    accentBorder: "border-[#d8c7b5]/30",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Collections" },
  { id: "botanical", label: "Botanical" },
  { id: "architectural", label: "Architectural" },
  { id: "abstract", label: "Abstract" },
  { id: "minimal", label: "Minimal" },
  { id: "vintage", label: "Vintage" },
  { id: "luxury", label: "Luxury" },
];

export default function ShopCatalogPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedComparisonSize, setSelectedComparisonSize] = useState<string>("16x20");

  const filteredPresets = activeCategory === "all"
    ? PRESET_CATALOG
    : PRESET_CATALOG.filter((item) => item.category === activeCategory);

  const currentSizeConfig = FRAME_SIZES[selectedComparisonSize] || FRAME_SIZES["16x20"];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />

      <main className="flex-1">
        {/* Catalog Hero Banner */}
        <section className="pt-12 pb-10 border-b border-[#EAE3DC] bg-[#FAF7F2] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-gradient-to-br from-[#B76E79]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn direction="up">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#EAE3DC] text-xs text-[#6B655F] mb-4 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Curated Fine Art Catalog</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-[#2D2A26]">
                  Acoustic Art <span className="rosegold-gradient-text italic">Collections</span>
                </h1>
                <p className="text-base sm:text-lg text-[#6B655F] mt-3 font-light leading-relaxed">
                  Eight curated design philosophies, from biophilic botanical to celestial noir. Select any collection to open the bespoke studio pre-loaded with its palette and aesthetic — then make it entirely yours.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <div className="flex items-center gap-2 text-xs text-[#6B655F] mr-2 pl-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Filter:</span>
                </div>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-[#B76E79] text-white shadow-sm"
                          : "bg-white text-[#6B655F] hover:text-[#2D2A26] border border-[#EAE3DC] hover:border-[#D8C7B5]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Interactive Wall Art Preset Cards Grid */}
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <p className="text-xs uppercase tracking-widest text-[#6B655F] font-mono">
                Showing {filteredPresets.length} Curated {filteredPresets.length === 1 ? "Design" : "Designs"}
              </p>
              <span className="text-xs text-[#6B655F]">
                All designs include solid wood framing & insured shipping
              </span>
            </div>

            <StaggerContainer
              key={activeCategory}
              staggerDelay={0.08}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredPresets.map((preset) => (
                <StaggerItem key={preset.id}>
                  <div className="group bg-white rounded-2xl border border-[#EAE3DC] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                    {/* Visual Mockup Card with 3D Magnetic Tilt */}
                    <div className="p-6 bg-[#FAF7F2] border-b border-[#EAE3DC]/60 flex items-center justify-center">
                      <MagneticFrame className="w-full max-w-[280px]">
                        <div className="relative shadow-lg aspect-[4/5] rounded-xl overflow-hidden border border-[#EAE3DC] pointer-events-none">
                          <WaveformCanvas
                            previewMode={true}
                            palette={PALETTES[preset.palette] || PALETTES["midnight_gold"]}
                            decorativeStyle={preset.template as DecorativeStyle}
                            caption={preset.sampleCaption}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </MagneticFrame>
                    </div>

                    {/* Preset Information & Direct Customizer CTA */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#B76E79]">
                            {preset.category}
                          </span>
                          <span className="text-xs font-semibold text-[#2D2A26]">
                            From ${FRAME_SIZES[preset.popularSize]?.priceCents ? FRAME_SIZES[preset.popularSize].priceCents / 100 : 49}
                          </span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#2D2A26] group-hover:text-[#B76E79] transition-colors">
                          {preset.title}
                        </h3>
                        <p className="text-xs text-[#6B655F] mt-1 line-clamp-2 leading-relaxed">
                          {preset.story}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#EAE3DC]/60 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-[#9E968F] font-mono">
                          Popular: {preset.popularSize}&quot;
                        </span>
                        <Link
                          href={`/product/custom?template=${preset.template}&palette=${preset.palette}&size=${preset.popularSize}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase font-bold tracking-wider bg-[#2D2A26] hover:bg-[#B76E79] text-white transition-all shadow-sm group-hover:shadow"
                        >
                          <span>Customize</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Frame Size Comparison Guide Section */}
        <section className="py-16 bg-[#F4EFEB] border-t border-[#EAE3DC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn direction="up">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#EAE3DC] text-xs text-[#6B655F] mb-3 shadow-sm">
                  <Maximize2 className="w-3.5 h-3.5 text-[#B76E79]" />
                  <span>Proportion & Scale Guide</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#2D2A26]">
                  Select the Ideal Frame Size for Your Space
                </h2>
                <p className="text-xs sm:text-sm text-[#6B655F] mt-2">
                  Compare our 4 physical dimensions against living room consoles, gallery walls, and bedside tables.
                </p>
              </div>

              {/* Size Selector Tabs */}
              <div className="flex justify-center gap-2 sm:gap-4 mb-10 overflow-x-auto pb-2">
                {Object.keys(FRAME_SIZES).map((sizeKey) => {
                  const config = FRAME_SIZES[sizeKey];
                  const isSelected = selectedComparisonSize === sizeKey;
                  return (
                    <button
                      key={sizeKey}
                      onClick={() => setSelectedComparisonSize(sizeKey)}
                      className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all text-left border ${
                        isSelected
                          ? "bg-[#2D2A26] text-white border-[#2D2A26] shadow-md"
                          : "bg-white text-[#6B655F] hover:text-[#2D2A26] border-[#EAE3DC]"
                      }`}
                    >
                      <div className="font-serif text-base">{config.dimensions}</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${isSelected ? "text-[#D8C7B5]" : "text-[#B76E79]"}`}>
                        {config.priceFormatted}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Visual Scale Comparison Box */}
              <div className="bg-white rounded-2xl border border-[#EAE3DC] p-8 max-w-4xl mx-auto shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  {/* Left: Wall Display Simulation */}
                  <div className="relative h-64 bg-[#EAE3DC]/40 rounded-xl border border-[#EAE3DC] flex flex-col items-center justify-center p-6 overflow-hidden">
                    <span className="absolute top-3 left-3 text-[10px] uppercase font-mono tracking-widest text-[#9E968F]">
                      Interior Wall Scale Preview
                    </span>

                    {/* Frame Mockup Scaled */}
                    <div
                      className="bg-white border-4 border-[#2D2A26] shadow-xl flex items-center justify-center transition-all duration-500"
                      style={{
                        width:
                          selectedComparisonSize === "8x10"
                            ? "100px"
                            : selectedComparisonSize === "11x14"
                            ? "135px"
                            : selectedComparisonSize === "16x20"
                            ? "175px"
                            : "220px",
                        height:
                          selectedComparisonSize === "8x10"
                            ? "125px"
                            : selectedComparisonSize === "11x14"
                            ? "170px"
                            : selectedComparisonSize === "16x20"
                            ? "220px"
                            : "260px",
                      }}
                    >
                      <div className="text-center p-2">
                        <p className="font-serif text-xs font-bold text-[#2D2A26]">
                          {currentSizeConfig.dimensions}
                        </p>
                        <p className="text-[9px] text-[#B76E79] font-mono">
                          {currentSizeConfig.priceFormatted}
                        </p>
                      </div>
                    </div>

                    {/* Furniture Reference Sill */}
                    <div className="absolute bottom-0 w-full h-3 bg-[#D8C7B5] border-t border-[#C5B4A2]" />
                  </div>

                  {/* Right: Specifications & CTA */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-[#2D2A26]">
                        {currentSizeConfig.name}
                      </h3>
                      <p className="text-xs text-[#B76E79] font-medium mt-0.5">
                        {currentSizeConfig.dimensions} · {currentSizeConfig.priceFormatted}
                      </p>
                    </div>

                    <ul className="space-y-2 text-xs text-[#6B655F]">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#B76E79]" />
                        <span>Museum-grade acid-free archival mat included</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#B76E79]" />
                        <span>Ready to hang with pre-installed brass hardware</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#B76E79]" />
                        <span>Aspect ratio: {currentSizeConfig.aspectRatio} physical proportion</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#B76E79]" />
                        <span>Insured courier shipping across the United States</span>
                      </li>
                    </ul>

                    <div className="pt-4">
                      <Link
                        href={`/product/custom?size=${selectedComparisonSize}`}
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs uppercase font-bold tracking-wider bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-md transition-all"
                      >
                        <span>Customize in {currentSizeConfig.dimensions} — {currentSizeConfig.priceFormatted}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
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
