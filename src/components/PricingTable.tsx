import React from "react";
import { FRAME_SIZES } from "@/lib/constants";

export default function PricingTable() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-[#FAF7F2] border-b border-[#EAE3DC] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#2D2A26] mt-3">
            Simple, All-Inclusive Frame Pricing
          </h2>
          <p className="text-[#6B655F] text-sm sm:text-base mt-3">
            Every SoundWave Art print includes your custom photo and waveform, solid wood frame, archival matte paper, QR playback, and free shipping.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.values(FRAME_SIZES).map((item) => {
            const isPopular = item.id === "16x20";
            return (
              <div
                key={item.id}
                className={`relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                  isPopular
                    ? "bg-[#FFFDFC] border-2 border-[#B76E79] shadow-xl shadow-[#B76E79]/10 -translate-y-2"
                    : "bg-white border border-[#EAE3DC] hover:border-[#D8C7B5] shadow-sm"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#B76E79] text-white text-[11px] font-bold uppercase tracking-wider rounded-full shadow">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-bold text-[#2D2A26]">{item.dimensions}</h3>
                  <p className="text-xs text-[#6B655F] mt-1">{item.name}</p>

                  <div className="mt-6 mb-6">
                    <span className="text-4xl font-serif font-bold text-[#2D2A26]">{item.priceFormatted}</span>
                    <span className="text-xs text-[#6B655F] ml-1.5">USD</span>
                  </div>

                  <ul className="space-y-3 text-xs text-[#6B655F]">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Personal Photo + Soundwave</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>300 DPI Archival Fine-Art Paper</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Solid Handcrafted Wood Frame</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Scannable Audio QR Code</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Custom Inscription Included</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#B76E79] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Free Insured Delivery</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8">
                  <a
                    href="#builder"
                    className={`block w-full text-center py-3 rounded-xl text-xs uppercase font-bold tracking-wider transition-all ${
                      isPopular
                        ? "bg-[#B76E79] text-white hover:bg-[#A05C66] shadow-md"
                        : "bg-[#FAF7F2] hover:bg-[#F4EFEB] text-[#2D2A26] border border-[#D8C7B5]"
                    }`}
                  >
                    Select {item.dimensions}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
