import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CTA } from "@/components/brand/Button";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `About — ${BRAND_NAME}`,
  description: "Why we make art from personal recordings, how each piece is made, and what we will never do with your recording.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <section className="mx-auto max-w-[1100px] px-4 py-14 sm:px-8">
          <p className="meta">About</p>
          <h1 className="display mt-4 text-[13vw] sm:text-[8vw] lg:text-[104px]">
            Some sounds <span className="accent !font-normal">deserve a wall.</span>
          </h1>
          {/* OWNER: add your own story here — who you are and why you started this. Real details build trust; please don't let anyone invent them. */}
          <div className="mt-10 grid gap-10 text-lg leading-relaxed md:grid-cols-2">
            <p>
              A voicemail you never deleted. Vows filmed from the second row. The first time a baby laughed. These recordings are often the only way to hear a moment again — and they live in a phone, one upgrade away from being lost.
            </p>
            <p>
              We turn the sound of those recordings into finished art: the moon exactly as it was on your date, circled by your sound, or a botanical specimen whose every leaf is grown from the recording. A small code on the print plays it back.
            </p>
          </div>
        </section>
        <section className="border-y-2 border-ink bg-paper-2">
          <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-14 sm:px-8 md:grid-cols-3">
            {[
              ["Made from your sound", "Every piece is generated from the loudness of your own recording. No stock waveforms, no templates filled in by hand."],
              ["What you see is what we print", "The preview is rendered by the same code as the print file, at 300 DPI, on archival paper."],
              ["Your recording stays yours", "Only the sound is uploaded — video never leaves your device. We never use recordings for marketing or AI training, and we delete them on request."],
            ].map(([t, b]) => (
              <div key={t}>
                <h2 className="display text-3xl">{t}</h2>
                <p className="mt-3 text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-[1100px] px-4 py-14 sm:px-8">
          <CTA href="/create">Make yours</CTA>
        </section>
      </main>
      <Footer />
    </div>
  );
}
