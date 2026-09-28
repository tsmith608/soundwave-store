import React from "react";

const TESTIMONIALS = [
  {
    name: "Margaux T.",
    location: "Nashville, TN",
    rating: 5,
    product: "Floral Botanical · 16×20\"",
    quote:
      "I recorded my husband saying our wedding vows the morning of the ceremony — he didn't know I had done it. Eight months later I framed it for our first anniversary. When he scanned the QR code and heard his own voice, he cried. We've never had a more meaningful thing hanging on our wall.",
    verified: true,
  },
  {
    name: "Priya N.",
    location: "Austin, TX",
    rating: 5,
    product: "Architectural Arch · 11×14\"",
    quote:
      "My mom saved my grandmother's last voicemail for six years but never knew what to do with it. I uploaded it here and had a framed portrait on her doorstep in four days. She called me sobbing. This product does something no other gift can — it makes a sound visible.",
    verified: true,
  },
  {
    name: "James R.",
    location: "Portland, OR",
    rating: 5,
    product: "Clean Minimal · 16×20\"",
    quote:
      "The live preview was what sold me. I could see exactly how the bars from our daughter's heartbeat recording would look in the frame before I ordered. The actual print exceeded it. The frame quality, the paper weight, the way the QR code is integrated — it doesn't look like a tech gimmick. It looks like art.",
    verified: true,
  },
  {
    name: "Celeste O.",
    location: "New York, NY",
    rating: 5,
    product: "Modern Double Border · 24×36\"",
    quote:
      "I run a photography studio and I've gifted these to clients after destination weddings. Every single couple has messaged me about the reaction their partner had. It has become my go-to referral gift. The turnaround is fast, the packaging is gorgeous, and the print is absolutely archival quality.",
    verified: true,
  },
  {
    name: "Devon & Lily K.",
    location: "Charleston, SC",
    rating: 5,
    product: "Floral Botanical · 8×10\"",
    quote:
      "We uploaded the recording of our baby's first word — 'mama' — and printed it above the crib. She's two now and we still haven't taken it down. We probably never will. Some things just become part of a home.",
    verified: true,
  },
  {
    name: "Sam W.",
    location: "Denver, CO",
    rating: 5,
    product: "Architectural Arch · 16×20\"",
    quote:
      "Ordered this as a memorial for my dad — I uploaded a voicemail he'd left me years ago. I wasn't sure it would feel right, but it does. It honors the sound of him. That's the only way I know how to put it. It honors the sound of him.",
    verified: true,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="w-3.5 h-3.5 text-[#D4AF37]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section
      id="stories"
      className="py-20 md:py-28 bg-[#F4EFEB] border-b border-[#EAE3DC] scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
            Verified Reviews
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#2D2A26] mt-3">
            Moments That Live{" "}
            <span className="rosegold-gradient-text italic">on the Wall</span>
          </h2>
          <p className="text-[#6B655F] text-sm sm:text-base mt-3">
            Every portrait carries a story that belongs to someone else. Here are a few of theirs.
          </p>

          {/* Aggregate rating */}
          <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 bg-white rounded-full border border-[#EAE3DC] shadow-sm">
            <StarRating count={5} />
            <span className="text-sm font-bold text-[#2D2A26]">4.97 out of 5</span>
            <span className="text-xs text-[#6B655F]">from 840+ verified purchases</span>
          </div>
        </div>

        {/* Review grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#EAE3DC] rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-[#D8C7B5] transition-all"
            >
              <div className="space-y-4">
                {/* Stars + product */}
                <div className="flex items-start justify-between gap-2">
                  <StarRating count={t.rating} />
                  {t.verified && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      Verified
                    </span>
                  )}
                </div>

                {/* Quote */}
                <blockquote className="text-sm text-[#2D2A26] leading-relaxed font-light border-l-2 border-[#B76E79]/40 pl-4 italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </div>

              {/* Attribution */}
              <div className="mt-6 pt-4 border-t border-[#EAE3DC] flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2D2A26]">{t.name}</p>
                  <p className="text-xs text-[#9E968F]">{t.location}</p>
                </div>
                <span className="text-[10px] text-[#B76E79] font-medium text-right leading-tight max-w-[120px]">
                  {t.product}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
