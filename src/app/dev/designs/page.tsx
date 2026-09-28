import React from "react";
import { notFound } from "next/navigation";
import Artwork from "@/components/art/Artwork";
import { DESIGNS, EXPLORATION_DESIGNS } from "@/lib/art";

export const metadata = { robots: { index: false, follow: false }, title: "Design explorations (internal)" };

/**
 * Internal gallery of every design, including rejected explorations with the
 * reason they were not sold. Disabled in production unless SHOW_DEV_PAGES=1.
 */
export default function DevDesigns() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DEV_PAGES !== "1") notFound();
  return (
    <main className="p-8 bg-[#E7E2DA] min-h-screen text-[#2D2A26]">
      <h1 className="font-serif text-4xl">All designs (internal)</h1>
      <p className="text-sm mt-2 max-w-2xl">Sellable designs first, then explorations kept for reference. Critique and scoring: docs/art-direction-2026.md.</p>
      {[
        ["Sold", DESIGNS],
        ["Explorations (not sold)", EXPLORATION_DESIGNS],
      ].map(([label, list]) => (
        <section key={label as string} className="mt-10">
          <h2 className="font-serif text-2xl">{label as string}</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {(list as typeof DESIGNS).map((d) => (
              <figure key={d.id}>
                <Artwork designId={d.id} fields={d.sample} idPrefix={`dev-${d.id}`} />
                <figcaption className="mt-2 text-xs">
                  <b>{d.name}</b> — {d.rationale}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
