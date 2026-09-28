import React from "react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-24 md:pt-24 md:pb-32 border-b border-[#EAE3DC]">
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#B76E79]/10 via-[#8A9A86]/8 to-transparent rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center space-y-7 max-w-4xl mx-auto">
          {/* Starting price badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 border border-[#E8C5B8] text-xs md:text-sm text-[#6B655F] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Museum-Grade Framed Portraits</span>
            <span className="font-semibold text-[#B76E79] bg-[#B76E79]/10 px-2 py-0.5 rounded-full border border-[#B76E79]/25">
              From $49
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif text-[#2D2A26] tracking-tight leading-[1.08]">
            The Sound of the Moment{" "}
            <span className="rosegold-gradient-text italic">
              You Never Want to Forget
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-22xl text-[#6B655F] font-light max-w-2xl leading-relaxed">
            Upload a voice note, a heartbeat, a song, or a spoken vow.
            We render your audio into a live soundwave, frame it alongside your photograph,
            and ship it ready to hang — with a scannable QR code that plays it back forever.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-3 w-full sm:w-auto">
            <Link
              href="/shop"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold uppercase tracking-wider text-sm bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
            >
              Explore the Collection
            </Link>
            <a
              href="/#stories"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-sm text-[#2D2A26] hover:text-[#B76E79] bg-white hover:bg-[#F4EFEB] border border-[#D8C7B5] shadow-sm transition-all"
            >
              Hear Their Stories
            </a>
          </div>

          {/* Trust strip */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 text-[#6B655F] text-xs w-full max-w-3xl">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                label: "300 DPI Archival Matte",
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                ),
                label: "Scannable QR Playback",
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                ),
                label: "Solid Hardwood Frame",
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                ),
                label: "Free Insured Delivery",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
