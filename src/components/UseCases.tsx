import React from "react";

interface UseCase {
  id: string;
  title: string;
  badge: string;
  desc: string;
  sampleAudioTitle: string;
  palette: string;
  quote: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "wedding",
    title: "Wedding Vows & Photo",
    badge: "Most Cherished Anniversary Keepsake",
    desc: "Pair your favorite wedding photo with the moment you said 'I do'. Immortalize your vows or first dance in museum-grade archival ink, natural wood, and scannable audio playback.",
    sampleAudioTitle: "'I promise to choose you every day...' — 09.20.2025",
    palette: "Blush Rose Gold",
    quote: "“The best anniversary gift we have ever received. Guests scan the print to hear our vows while seeing our favorite wedding portrait.”",
  },
  {
    id: "baby",
    title: "Baby's Ultrasound & Heartbeat",
    badge: "Unforgettable Nursery Heirloom",
    desc: "Pair your 20-week sonogram photo with delicate botanical flourishes and the rhythmic flutter of baby's heartbeat or their very first coos.",
    sampleAudioTitle: "154 BPM Ultrasound Heartbeat — Week 20",
    palette: "Sage Eucalyptus",
    quote: "“Having our daughter's ultrasound photo and heartbeat framed above her crib brings tears to my eyes every single day.”",
  },
  {
    id: "memorial",
    title: "Memorial & Favorite Song",
    badge: "Timeless Remembrance",
    desc: "Honor a cherished loved one with their portrait and a saved voicemail, or celebrate the soundtrack that defined your life's greatest adventures.",
    sampleAudioTitle: "'I love you sweetheart, call me back' — Voicemail",
    palette: "Warm Sand",
    quote: "“Hearing my late father's voice through the QR code beside his smile brought our entire family immense comfort and joy.”",
  },
];

export default function UseCases() {
  return (
    <section id="use-cases" className="py-20 md:py-28 bg-[#F4EFEB] border-b border-[#EAE3DC] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#B76E79] bg-[#B76E79]/10 px-3.5 py-1 rounded-full border border-[#B76E79]/20">
            Meaningful Stories
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#2D2A26] mt-3">
            Every Voice & Photo Tells a Unique Story
          </h2>
          <p className="text-[#6B655F] text-sm sm:text-base mt-3">
            Discover how thousands of families turn life&apos;s most fleeting acoustic moments and beloved photographs into breathtaking visual heirlooms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {USE_CASES.map((uc) => (
            <div
              key={uc.id}
              className="bg-white border border-[#EAE3DC] hover:border-[#B76E79]/50 rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl shadow-sm group"
            >
              <div>
                <span className="text-[11px] font-semibold text-[#B76E79] uppercase tracking-wider block mb-2">
                  {uc.badge}
                </span>
                <h3 className="text-2xl font-serif text-[#2D2A26] group-hover:text-[#B76E79] transition-colors">
                  {uc.title}
                </h3>
                <p className="text-[#6B655F] text-sm mt-3 leading-relaxed">
                  {uc.desc}
                </p>

                {/* Simulated Audio Strip */}
                <div className="mt-6 p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE3DC] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#6B655F]">
                    <span className="truncate font-mono">{uc.sampleAudioTitle}</span>
                    <span className="text-[#B76E79] text-[10px] font-bold">SAMPLE</span>
                  </div>
                  {/* Stylized waveform spikes */}
                  <div className="h-10 flex items-center justify-between gap-[3px] px-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {[30, 45, 80, 60, 95, 40, 70, 85, 100, 65, 50, 90, 75, 40, 80, 55, 35].map(
                      (h, i) => (
                        <span
                          key={i}
                          className="flex-1 bg-gradient-to-t from-[#D8C7B5] to-[#B76E79] rounded-full"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                <p className="text-xs italic text-[#6B655F] mt-6 border-l-2 border-[#B76E79]/50 pl-3">
                  {uc.quote}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#EAE3DC] flex items-center justify-between">
                <span className="text-xs text-[#6B655F]">Palette: <strong className="text-[#2D2A26]">{uc.palette}</strong></span>
                <a
                  href="/shop"
                  className="text-xs font-semibold text-[#B76E79] hover:underline flex items-center gap-1"
                >
                  Design yours →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
