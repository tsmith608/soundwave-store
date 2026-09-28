import React from "react";
import { samplePeaks } from "@/lib/art";

type Pt = [number, number];

/** Heavily smoothed amplitude envelope → organic contour points. */
function contour(seed: string, n: number, kind: "voice" | "song" | "heartbeat" = "voice"): number[] {
  const p = samplePeaks(seed, kind, 400);
  const out: number[] = [];
  const win = Math.floor(400 / n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < win; j++) s += p[i * win + j];
    out.push(s / win);
  }
  // second smoothing pass
  return out.map((_, i) => (out[i - 1] ?? out[i]) * 0.25 + out[i] * 0.5 + (out[i + 1] ?? out[i]) * 0.25);
}

function smoothPath(pts: Pt[], move = true): string {
  let d = move ? `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}` : `L${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(
      p2[1] -
      (p3[1] - p1[1]) / 6
    ).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * The brand's recurring organic form: a recording's loudness envelope,
 * smoothed into a soft mirrored silhouette (like the Aardvark swirls, but
 * derived from sound).
 */
export function MemoryTrace({ seed, fill, className = "", points = 18, kind }: { seed: string; fill: string; className?: string; points?: number; kind?: "voice" | "song" | "heartbeat" }) {
  const c = contour(seed, points, kind);
  const W = 1000;
  const H = 600;
  const top: Pt[] = c.map((v, i) => [(i / (points - 1)) * W, H / 2 - (40 + v * 230)]);
  const bottom: Pt[] = c.map((v, i): Pt => [(i / (points - 1)) * W, H / 2 + (40 + v * 230)]).reverse();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={smoothPath(top) + smoothPath(bottom, false) + "Z"} fill={fill} />
    </svg>
  );
}

/** Section boundary whose edge follows a smoothed recording envelope. */
export function WaveEdge({ seed, fill, flip = false, className = "" }: { seed: string; fill: string; flip?: boolean; className?: string }) {
  const n = 14;
  const c = contour(seed, n);
  const W = 1440;
  const H = 120;
  const pts: Pt[] = c.map((v, i) => [(i / (n - 1)) * W, H - 12 - v * (H - 24)]);
  const d = smoothPath(pts) + `L${W} ${H}L0 ${H}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block w-full h-[48px] sm:h-[80px] ${flip ? "rotate-180" : ""} ${className}`} aria-hidden>
      <path d={d} fill={fill} />
    </svg>
  );
}

/** A drawn oscilloscope-style line of a recording (animates in once). */
export function WaveLine({ seed, stroke = "currentColor", className = "", count = 140, kind = "voice", animate = true, width = 2 }: { seed: string; stroke?: string; className?: string; count?: number; kind?: "voice" | "song" | "heartbeat"; animate?: boolean; width?: number }) {
  const p = samplePeaks(seed, kind, 400);
  const W = 1000;
  const H = 120;
  const pts: string[] = [];
  for (let i = 0; i < count; i++) {
    const v = p[Math.floor((i / count) * 400)];
    const sign = i % 2 ? 1 : -1;
    const edge = Math.min(1, i / 6, (count - 1 - i) / 6);
    pts.push(`${((i / (count - 1)) * W).toFixed(1)},${(H / 2 + sign * v * edge * (H / 2 - 4)).toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        className={animate ? "anim-draw" : undefined}
        style={animate ? ({ "--len": 6000 } as React.CSSProperties) : undefined}
        pathLength={animate ? 6000 : undefined}
      />
    </svg>
  );
}

/** Bars version, used in the phone clip scrubber and upload states. */
export function WaveBars({ peaks, className = "", color = "currentColor", count = 60 }: { peaks: number[]; className?: string; color?: string; count?: number }) {
  const W = count * 4;
  return (
    <svg viewBox={`0 0 ${W} 40`} className={className} preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const v = peaks[Math.floor((i / count) * peaks.length)] ?? 0;
        const h = Math.max(2, v * 36);
        return <rect key={i} x={i * 4 + 0.8} y={20 - h / 2} width={2.4} height={h} rx={1.2} fill={color} />;
      })}
    </svg>
  );
}
