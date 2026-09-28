import React from "react";
import Link from "next/link";

const STEPS = [
  {
    number: "01",
    title: "Choose Your Story",
    subtitle: "Browse curated design collections",
    description:
      "Select from eight hand-crafted aesthetic styles — botanical, architectural, celestial, and more. Each template is pre-configured with a palette and frame size that complements the mood of your moment.",
    cta: "Browse Collections →",
    href: "/shop",
  },
  {
    number: "02",
    title: "Compose Your Portrait",
    subtitle: "Live studio preview in seconds",
    description:
      "Upload a beloved photograph and your audio — a voice note, a song, a heartbeat, or vows spoken once and never repeated. Watch the soundwave render in real time. Adjust the palette, border style, and personal inscription until it is exactly right.",
    cta: "Open the Studio →",
    href: "/product/custom",
  },
  {
    number: "03",
    title: "We Handle Everything",
    subtitle: "Museum-grade. Door to door.",
    description:
      "From the moment you check out, our automated studio generates a 300 DPI print-ready file and dispatches it to our master framers. Your portrait arrives hand-framed, ready to hang, with a scannable QR code that plays the audio back in full.",
    cta: null,
    href: null,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-[#FAF7F2] border-b border-[#EAE3DC] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
            The Process
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#2D2A26] mt-3">
            From a Single Sound to a{" "}
            <span className="rosegold-gradient-text italic">Lifetime of Display</span>
          </h2>
          <p className="text-[#6B655F] text-sm sm:text-base mt-3 leading-relaxed">
            Three steps. One conversation with your most irreplaceable memories. Zero manual intervention.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line — desktop only */}
          <div
            className="hidden lg:block absolute top-[3.25rem] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D8C7B5] to-transparent"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
            {STEPS.map((step, idx) => (
              <div key={step.number} className="relative flex flex-col">
                {/* Step number circle */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative z-10 w-14 h-14 rounded-full bg-white border-2 border-[#B76E79] flex items-center justify-center shadow-sm shrink-0">
                    <span className="font-serif text-lg font-bold text-[#B76E79]">
                      {step.number}
                    </span>
                  </div>
                  {/* Mobile connector line */}
                  {idx < STEPS.length - 1 && (
                    <div className="lg:hidden flex-1 h-px bg-[#EAE3DC]" />
                  )}
                </div>

                <div className="pl-0 lg:pl-0 space-y-2">
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-[#B76E79]">
                    {step.subtitle}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#6B655F] leading-relaxed mt-2">
                    {step.description}
                  </p>

                  {step.cta && step.href && (
                    <div className="pt-3">
                      <Link
                        href={step.href}
                        className="inline-flex items-center text-sm font-semibold text-[#B76E79] hover:text-[#A05C66] transition-colors group"
                      >
                        {step.cta}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/shop"
            className="px-8 py-4 rounded-xl font-bold uppercase tracking-wider text-sm bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            Explore the Collection
          </Link>
          <Link
            href="/product/custom"
            className="px-8 py-4 rounded-xl font-semibold text-sm text-[#2D2A26] hover:text-[#B76E79] bg-white hover:bg-[#F4EFEB] border border-[#D8C7B5] shadow-sm transition-all"
          >
            Open the Studio Directly
          </Link>
        </div>
      </div>
    </section>
  );
}
