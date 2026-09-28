"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

// Keep every claim here true to the implementation (docs/memory-audio-pivot-audit.md).
export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What can I upload?",
    answer:
      "An audio or video recording you made or have permission to use: a voice memo, saved voicemail, wedding clip, Snapchat memory you've saved to your phone, a baby's laugh, a pet, vows, an original recording. MP4, MOV, M4V, M4A, MP3, WAV, AAC and WebM all work, or you can record straight in your browser.",
  },
  {
    question: "Can I upload a video?",
    answer:
      "Yes. Your browser extracts the video's soundtrack and only the sound is uploaded — the footage never leaves your device. Videos up to 15 minutes long work; for longer ones, trim to the moment you want.",
  },
  {
    question: "Can I use a Snapchat memory?",
    answer:
      "Yes — save or export the memory to your phone's camera roll first, then upload that video. We don't connect to Snapchat or any other account.",
  },
  {
    question: "Can I paste a Spotify or YouTube link instead?",
    answer:
      "Not to make the art. The artwork is always generated from the audio or video file you upload — we don't download or analyse anything from streaming links. You can add a public link (a Spotify or Apple Music song, a YouTube video, a shared album) as the optional destination of the printed code, and you can add a song title as a small line of context on the print.",
  },
  {
    question: "What kind of recordings work best?",
    answer:
      "Anything with a sound you care about: speech, vows, laughter, a voicemail, ambient sound from a special place, pet sounds, original music. Short is fine — even a few seconds makes a complete piece.",
  },
  {
    question: "Do I need a professional-quality recording?",
    answer:
      "No. Phone recordings, old voicemails and noisy videos all work. The artwork follows how the loudness of your recording rises and falls over time, so background noise just becomes part of its shape.",
  },
  {
    question: "Do I have to design anything?",
    answer:
      "No. You choose The Night Of or Herbarium and type your words — the layout, type and colour are already decided. The preview is exactly what we print.",
  },
  {
    question: "How long does it take?",
    answer:
      "Each piece is made to order in 3–5 business days, then shipped with tracking in the US — usually 5–9 business days in total. For Christmas delivery, order by December 10.",
  },
  {
    question: "What if something's wrong?",
    answer:
      "If it arrives damaged or doesn't match your preview, email us a photo and we'll reprint it free. Because every piece is personalised, we can't take change-of-mind returns — please check names and dates in the preview.",
  },
  {
    question: "Is my upload private?",
    answer:
      "We use your recording to make your artwork and, if you choose the playback option, to play it from your printed code's private link. We don't publish it or use it for anything else. To have it deleted, email us and we'll remove it.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t-2 border-ink">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
        <h2 className="display text-[16vw] lg:col-span-4 lg:text-[112px]">
          Good <span className="accent !font-normal">questions.</span>
        </h2>
        <div className="lg:col-span-8">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={item.question} className="border-b-2 border-ink">
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
