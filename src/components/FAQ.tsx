"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What can I turn into a print?",
    answer:
      "Any recording with a sound you care about: your first-dance song, vows from a wedding video, a voicemail, a baby's heartbeat from a scan video, a pet's bark, a voice note. MP3, M4A, WAV and WebM files up to 50 MB all work, and you can record directly in the browser.",
  },
  {
    question: "Do I have to design anything?",
    answer:
      "No. You choose one of five finished designs and type your words. The layout, typefaces and colours are already set, so there's nothing to arrange. What you see in the preview is exactly what we print.",
  },
  {
    question: "How does the scan-to-listen code work?",
    answer:
      "If you keep the code switched on, it's printed small on the artwork. Point any phone camera at it and your recording plays in the browser — no app, no account. The page is unlisted and only reachable through the code or the link we email you.",
  },
  {
    question: "How are the prints made?",
    answer:
      "Printed to order with pigment inks on heavyweight archival matte fine-art paper. Framed prints come in a solid wood frame with a white mount and shatterproof acrylic glazing, with hanging hardware fitted. The artwork is sent to the printer as a vector file, so type and linework stay sharp at every size.",
  },
  {
    question: "How long does it take?",
    answer:
      "Each print is made to order in 3–5 business days, then delivered by tracked US shipping, usually 5–9 business days from your order in total. For Christmas delivery in the US, order by December 10.",
  },
  {
    question: "What if something's wrong?",
    answer:
      "If your print arrives damaged, or we've printed something differently from your preview, email us a photo and we'll reprint it free. Because every piece is personalised, we can't accept returns for a change of mind — so please check spelling and dates in the preview.",
  },
  {
    question: "Is my recording private?",
    answer:
      "Yes. We use it to draw your artwork and, if you choose, to play it back from the code. We never publish it, share it, or use it for anything else, and we'll delete it on request.",
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
        <div className="mb-10">
          <h2 className="text-4xl sm:text-5xl font-serif text-[#2D2A26]">Questions</h2>
          <p className="text-[#6B655F] mt-3">Materials, recordings, delivery and privacy, answered plainly.</p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndices.includes(idx);
            return (
              <div
                key={idx}
                className="rounded-md bg-white border border-[#E6DFD6] overflow-hidden transition-colors"
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
                    className={`w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#EAE3DC] flex items-center justify-center shrink-0 text-[#2D2A26] transition-transform duration-200 ${
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
