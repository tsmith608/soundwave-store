import React from "react";
import { samplePeaks } from "@/lib/art";
import { WaveBars } from "./shapes";

const SCENES: Record<string, string> = {
  dusk: "radial-gradient(120% 80% at 30% 20%, #f7c08a 0%, #d9745a 35%, #5b3550 70%, #1c1a2b 100%)",
  garden: "radial-gradient(120% 90% at 70% 10%, #f4f0d6 0%, #b9c98f 30%, #5d7d4f 65%, #22321f 100%)",
  night: "radial-gradient(120% 90% at 50% 0%, #6d7fa8 0%, #2c3a63 40%, #10172a 100%)",
  warm: "radial-gradient(110% 80% at 40% 30%, #fbe3c4 0%, #e3a877 40%, #8a4f3b 80%)",
  blue: "radial-gradient(120% 90% at 30% 20%, #cfe3f2 0%, #7aa1c7 40%, #2f4a6b 100%)",
};

/**
 * A stylised vertical phone clip: the messy source memory we contrast against
 * the finished print. Generic UI (no platform branding); always labelled demo.
 */
export default function PhoneMemory({
  file = "IMG_4471.MOV",
  stamp = "JUN 14 2025 · 21:42",
  length = "00:13",
  scene = "dusk",
  seed = "phone",
  caption,
  className = "",
  playing = true,
}: {
  file?: string;
  stamp?: string;
  length?: string;
  scene?: keyof typeof SCENES;
  seed?: string;
  caption?: string;
  className?: string;
  playing?: boolean;
}) {
  const peaks = samplePeaks(seed, "voice", 120);
  return (
    <figure className={`relative aspect-[9/16] w-full overflow-hidden rounded-[22px] border border-ink/15 bg-ink shadow-soft ${className}`}>
      <div className="absolute inset-0" style={{ background: SCENES[scene] }} />
      {/* soft blurry "footage" blobs */}
      <div className="absolute -left-6 top-1/3 h-32 w-32 rounded-full bg-white/25 blur-2xl" aria-hidden />
      <div className="absolute right-0 top-1/2 h-40 w-24 rounded-full bg-black/25 blur-2xl" aria-hidden />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 pt-3 text-white">
        <span className="meta flex min-w-0 items-center gap-1.5 !text-[9px]">
          <span className="anim-blink inline-block h-2 w-2 shrink-0 rounded-full bg-signal" aria-hidden />
          <span className="truncate">{file}</span>
        </span>
        <span className="meta shrink-0 !text-[9px] opacity-80">{length}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-white">
        {caption && <div className="accent text-lg leading-tight mb-2">{caption}</div>}
        <WaveBars peaks={peaks} className="h-7 w-full" color="rgba(255,255,255,.9)" />
        <div className="mt-1.5 h-[2px] w-full bg-white/25">
          <div className={`h-full w-full bg-white ${playing ? "anim-playhead" : ""}`} />
        </div>
        <div className="meta mt-1.5 truncate whitespace-nowrap !text-[9px] opacity-75">{stamp}</div>
      </div>
      <figcaption className="sr-only">Example phone video used as a source recording (demo).</figcaption>
    </figure>
  );
}
