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
    <section id="reviews" className="py-20 border-t border-[#E6DFD6]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl sm:text-4xl text-[#2D2A26]">From people who&apos;ve hung one</h2>
        <p className="mt-2 text-sm text-[#6B655F]">
          {avg.toFixed(1)} out of 5 from {REVIEWS.length} review{REVIEWS.length === 1 ? "" : "s"} of delivered orders.
        </p>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <figure key={r.orderId} className="bg-white border border-[#E6DFD6] p-6">
              <div aria-label={`${r.rating} out of 5`} className="text-[#2D2A26] tracking-widest text-sm">
                {"★".repeat(r.rating)}
                <span className="text-[#D8D0C6]">{"★".repeat(5 - r.rating)}</span>
              </div>
              <blockquote className="mt-3 text-[15px] leading-relaxed text-[#2D2A26]">{r.text}</blockquote>
              <figcaption className="mt-4 text-xs text-[#7A736B]">
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
