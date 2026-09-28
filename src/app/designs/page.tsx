import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Artwork from "@/components/art/Artwork";
import { DESIGNS } from "@/lib/art";

export const metadata: Metadata = {
  title: "The Designs — SoundWave Art",
  description: "Two finished designs made from your recording: The Night Of (the real moon on your date) and Herbarium (a botanical grown from your sound).",
  alternates: { canonical: "/designs" },
};

export default function DesignsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#2D2A26]">
      <Navbar />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">
          <h1 className="font-serif text-5xl sm:text-6xl tracking-tight max-w-3xl">Two designs, each one finished.</h1>
          <p className="mt-5 text-lg text-[#4A453F] max-w-2xl leading-relaxed">
            We don&apos;t ask you to assemble borders and ornaments. The Night Of draws the real moon for your date, ringed by your recording. Herbarium grows your recording into a pressed botanical, one leaf per moment of sound. Your words fill in the rest.
          </p>
        </section>
        {DESIGNS.map((d, i) => (
          <section key={d.id} className={`py-14 ${i % 2 ? "bg-[#F1ECE4]" : ""}`}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.4fr] gap-10 items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#7A736B]">{d.direction}</div>
                <h2 className="mt-2 font-serif text-4xl">{d.name}</h2>
                <p className="mt-4 text-[#4A453F] leading-relaxed">{d.tagline}</p>
                <p className="mt-4 text-sm text-[#6B655F]">Often chosen for: {d.bestFor.join(", ").toLowerCase()}.</p>
                <Link href={`/create?design=${d.id}`} className="mt-6 inline-block px-6 py-3 rounded-md bg-[#2D2A26] hover:bg-black text-white text-sm">
                  Start with {d.name}
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {d.colorways.map((c) => (
                  <figure key={c.id}>
                    <div className="shadow-[0_12px_28px_rgba(40,30,20,.15)]">
                      <Artwork designId={d.id} fields={d.sample} colorwayId={c.id} idPrefix={`dz-${c.id}`} showQr={false} />
                    </div>
                    <figcaption className="mt-2 text-xs text-[#7A736B]">{c.name}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
