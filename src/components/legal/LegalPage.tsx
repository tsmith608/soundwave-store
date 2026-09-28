import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Shared layout for /terms and /privacy: readable measure, numbered sections. */
export default function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-12 sm:px-8">
          <p className="meta">Last updated · {updated}</p>
          <h1 className="display mt-4 text-[15vw] sm:text-[9vw] lg:text-[112px]">{title}</h1>
          <div className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">{intro}</div>
        </section>
        <article className="legal mx-auto max-w-[1440px] border-t-2 border-ink px-4 pb-24 pt-10 sm:px-8">
          <div className="max-w-[72ch] space-y-10 text-[17px] leading-relaxed">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} className="scroll-mt-24">
      <h2 className="display flex items-baseline gap-3 text-3xl sm:text-4xl">
        <span className="text-signal">{n}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">{children}</div>
    </section>
  );
}
