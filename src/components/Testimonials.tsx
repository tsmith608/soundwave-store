import React from "react";
import { REVIEWS } from "@/lib/reviews";
import { getDesign } from "@/lib/art";

/**
 * Social proof from real, delivered orders only (see src/lib/reviews.ts).
 * Renders nothing until the first review exists — no placeholder ratings.
 */
export default function Testimonials() {
  if (REVIEWS.length === 0) return null;
  const avg = REVIEWS.reduce((s, r) => s + r.rating, 0) / REVIEWS.length;
  return (
    <section id="reviews" className="border-t-2 border-ink py-20">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <h2 className="display text-5xl sm:text-7xl">From people who&apos;ve <span className="accent !font-normal">hung one.</span></h2>
        <p className="meta mt-4">
          {avg.toFixed(1)} out of 5 from {REVIEWS.length} review{REVIEWS.length === 1 ? "" : "s"} of delivered orders.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.orderId} className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_#151412]">
              <div aria-label={`${r.rating} out of 5`} className="tracking-widest text-sm text-signal">
                {"★".repeat(r.rating)}
                <span className="opacity-25">{"★".repeat(5 - r.rating)}</span>
              </div>
              <blockquote className="accent mt-3 text-2xl leading-snug">{r.text}</blockquote>
              <figcaption className="meta mt-4">
                {r.name}
                {r.location ? `, ${r.location}` : ""} · {getDesign(r.designId)?.name ?? ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
