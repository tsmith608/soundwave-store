"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How does SoundWave Art work?",
    answer:
      "When you record audio or upload a sound file, our audio engine extracts thousands of amplitude points from your audio frequencies. We transform those peaks into discrete, elegant rounded sound wave pill bars rendered in your chosen palette, creating a one-of-a-kind visual representation of your exact voice or song.",
  },
  {
    question: "Can I combine a personal photo with my sound wave?",
    answer:
      "Yes! Our interactive studio lets you upload any personal photo (.jpg, .jpeg, or .png) — such as wedding portraits, baby sonograms, family photos, or pet memories. We composite your photo alongside your soundwave with your choice of decorative style (Floral Botanical, Modern Double Border, Elegant Arch, or Clean Minimal).",
  },
  {
    question: "What audio formats can I upload?",
    answer:
      "We support all standard audio formats including MP3, WAV, WebM, M4A, and AAC files up to 50MB. You can also record your voice directly in your browser with our built-in live microphone studio.",
  },
  {
    question: "How long does fulfillment and delivery take?",
    answer:
      "All orders enter our automated fulfillment pipeline immediately upon checkout. Your 300 DPI print-ready artwork is compiled, printed on museum-grade paper, custom framed, and shipped via FedEx or USPS within 2 to 4 business days. Standard US delivery takes 3 to 5 business days.",
  },
  {
    question: "Can I scan the QR code to play the sound?",
    answer:
      "Yes! Every print includes an elegantly integrated QR code discreetly positioned in the corner. Anyone can scan the QR code using any smartphone camera to instantly play back the original audio recording with crystal clear clarity.",
  },
  {
    question: "What paper and framing materials do you use?",
    answer:
      "We use 240+ GSM museum-grade archival fine-art matte paper with genuine pigment inks that will not fade for over 100 years. Each frame is crafted from 100% solid real wood with a satin matte finish and fitted with shatterproof optical acrylic.",
  },
];

export default function FAQ() {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  const toggleItem = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-[#F4EFEB] border-b border-[#EAE3DC] scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
            Good Questions
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#2D2A26] mt-3">
            Everything You&apos;d Want to{" "}
            <span className="rosegold-gradient-text italic">Know Before You Order</span>
          </h2>
          <p className="text-[#6B655F] text-sm sm:text-base mt-3">
            On materials, audio formats, turnaround times, and how the QR playback works — answered plainly.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndices.includes(idx);
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-[#EAE3DC] overflow-hidden shadow-sm transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(idx)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 focus:outline-none hover:bg-[#FAF7F2] transition-colors"
                >
                  <span className="text-base sm:text-lg font-medium text-[#2D2A26]">
                    {item.question}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center shrink-0 text-[#B76E79] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-[#6B655F] leading-relaxed border-t border-[#EAE3DC]">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
