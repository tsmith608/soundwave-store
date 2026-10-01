"use client";

import React, { useState } from "react";

import { FAQ_ITEMS } from "@/lib/faq";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-ink/15">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
        <h2 className="display text-[16vw] lg:col-span-4 lg:text-[112px]">
          Good <span className="accent !font-normal">questions.</span>
        </h2>
        <div className="lg:col-span-8">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={item.question} className="border-b border-ink/15">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex min-h-[64px] w-full items-center justify-between gap-6 py-4 text-left"
                >
                  <span className="text-xl font-semibold sm:text-2xl">{item.question}</span>
                  <span className={`display text-3xl transition-transform ${isOpen ? "rotate-45" : ""}`} aria-hidden>
                    +
                  </span>
                </button>
                {isOpen && <p className="max-w-2xl pb-6 text-lg leading-relaxed text-ink-soft">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
