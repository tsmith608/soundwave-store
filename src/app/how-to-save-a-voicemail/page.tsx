import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "How to Save a Voicemail on iPhone or Android (Before It's Deleted) | SoundWave Art",
  description:
    "Step-by-step: export a voicemail from an iPhone, an Android phone or a carrier mailbox, and back it up so a loved one's voice isn't lost when a line is cancelled or a phone is replaced.",
  alternates: { canonical: "/how-to-save-a-voicemail" },
};

const steps = [
  {
    h: "On an iPhone",
    items: [
      "Open the Phone app and tap Voicemail (bottom right).",
      "Tap the message, then the Share button (the square with an arrow).",
      "Choose Save to Files, or Mail / Messages to send it to yourself. You now have an .m4a audio file.",
      "Deleted by accident? Scroll to Deleted Messages at the bottom of the Voicemail list — iPhone keeps them there for a while before they're gone for good.",
    ],
  },
  {
    h: "On an Android phone",
    items: [
      "In the Phone app (Phone by Google), open the Voicemail tab and tap the message.",
      "Tap the three-dot menu, then Share, and save it to Drive, Gmail or Files.",
      "On Samsung or carrier-branded phones, open your carrier's visual voicemail app and look for Save, Export or Share on the message.",
    ],
  },
  {
    h: "If there's no save button",
    items: [
      "Play the voicemail on speaker and record it with another phone's voice-memo app, or start your phone's screen recorder while it plays (the recording includes the sound).",
      "Call your carrier's support line and ask whether they can export the voicemail or turn on voicemail-to-email.",
      "Do this soon: carriers commonly delete saved voicemails after a few weeks, and cancelling, porting or switching a line can wipe the mailbox.",
    ],
  },
  {
    h: "Then keep it safe",
    items: [
      "Keep at least two copies in different places — for example cloud storage and a computer or USB drive.",
      "Rename the file with who, what and when (e.g. “Mom – birthday voicemail – 2021-03-11.m4a”) so family can find it.",
      "Share a copy with siblings or family now, while everyone remembers which message matters.",
    ],
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to save a voicemail before it's deleted",
    step: steps.flatMap((s) => s.items.map((t) => ({ "@type": "HowToStep", text: t }))),
  };
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7A736B]">Guide</p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight">How to save a voicemail before it&apos;s deleted</h1>
          <p className="mt-6 text-lg text-[#4A453F] leading-relaxed">
            For a lot of families, a voicemail is the only recording of someone&apos;s everyday voice. Voicemails live on your carrier&apos;s servers or in your phone&apos;s app — not in your photos — and they
            can disappear when a line is cancelled, a number is ported or a phone is replaced. Here&apos;s how to get a copy you control.
          </p>
          {steps.map((s) => (
            <section key={s.h} className="mt-10">
              <h2 className="font-serif text-3xl">{s.h}</h2>
              <ol className="mt-4 space-y-3 list-decimal pl-5 text-[#4A453F] leading-relaxed">
                {s.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </section>
          ))}
          <section className="mt-14 border-t border-[#E6DFD6] pt-10">
            <h2 className="font-serif text-3xl">If you&apos;d like to keep it on the wall</h2>
            <p className="mt-3 text-[#4A453F] leading-relaxed">
              Once you have the file, you can turn it into a quiet memorial print — their name, their voice drawn as a single line, the words they said — with a code that plays the message from any phone.
            </p>
            <Link href="/voicemail-memorial-art" className="mt-6 inline-block px-6 py-3 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm">
              See voicemail memorial prints
            </Link>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
