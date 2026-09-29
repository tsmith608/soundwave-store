import React from "react";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Artwork from "@/components/art/Artwork";
import { CTA } from "@/components/brand/Button";
import Reveal from "@/components/brand/Reveal";
import { WaveEdge } from "@/components/brand/shapes";
import { getDesign } from "@/lib/art";

export const metadata: Metadata = {
  title: "The Art — The Night Of & Herbarium | SoundWave Art",
  description: "Two finished keepsake designs generated from your own recording: The Night Of (the real moon on your date, surrounded by your sound) and Herbarium (a botanical specimen grown from your recording).",
  alternates: { canonical: "/designs" },
};

const COLLECTIONS = [
  {
    id: "night-of",
    world: "bg-night text-night-ink on-dark",
    fill: "var(--night)",
    kicker: "Collection 01 · Night",
    made: "We compute the moon’s phase and illumination for your exact date and draw it as it was. Around it, a ring of rays traces the loudness of your recording from start to finish.",
    occasions: "The night you met, a wedding, a proposal, an anniversary, a birth — or a night you never want to forget.",
  },
  {
    id: "herbarium",
    world: "bg-botanical text-botanical-ink",
    fill: "var(--botanical)",
    kicker: "Collection 02 · Botanical",
    made: "We measure how loud your recording is from its first second to its last. Each leaf’s length is the loudness at that moment, root to tip — so the plant is grown from your recording, not chosen from a preset.",
    occasions: "Vows, voices, laughter, family memories, pet sounds and recordings worth keeping.",
  },
];

export default function DesignsPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Navbar />
      <main id="main" className="flex-1">
        <section className="mx-auto max-w-[1440px] px-4 pb-12 pt-12 sm:px-8">
          <p className="meta">The art</p>
          <h1 className="display mt-4 max-w-5xl text-[14vw] sm:text-[9vw] lg:text-[120px]">
            Two designs. Both <span className="accent !font-normal">grown from your sound.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">
            No borders to pick, no clip art. Each piece is a finished composition — your recording shapes it, your words complete it.
          </p>
        </section>
        {COLLECTIONS.map((col, idx) => {
          const d = getDesign(col.id)!;
          return (
            <React.Fragment key={col.id}>
              <WaveEdge seed={`designs-${col.id}`} fill={col.fill} />
              <section className={col.world}>
                <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-8">
                  <div className="grid gap-10 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                      <p className="meta opacity-75">{col.kicker}</p>
                      <h2 className="display mt-3 text-[18vw] lg:text-[128px]">{d.name}</h2>
                      <p className="mt-6 text-xl leading-relaxed">{d.tagline}</p>
                      <div className="mt-8 border-l-4 border-current pl-5">
                        <p className="meta mb-2 opacity-75">How it’s made</p>
                        <p className="leading-relaxed">{col.made}</p>
                      </div>
                      <p className="meta mt-6 opacity-75">Often chosen for: {col.occasions}</p>
                      <div className="mt-10">
                        <CTA href={`/create?design=${d.id}`}>Start with {d.name}</CTA>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-2 xl:grid-cols-3">
                      {d.colorways.map((c, i) => (
                        <Reveal as="figure" key={c.id} delay={i * 100} className={i === 0 && idx === 1 ? "" : ""}>
                          <div className="border-2 border-current shadow-[6px_6px_0_currentColor]">
                            <Artwork designId={d.id} fields={d.sample} colorwayId={c.id} qrStyle="discreet" idPrefix={`dz-${c.id}`} />
                          </div>
                          <figcaption className="meta mt-3">{c.name}</figcaption>
                        </Reveal>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <WaveEdge seed={`designs-${col.id}-b`} fill={col.fill} flip />
            </React.Fragment>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
