/**
 * Waveform data utilities. Peaks are amplitude envelopes in 0..1.
 * The configurator extracts ~400 peaks from the customer's recording in the
 * browser; every design resamples that to the resolution it needs.
 */

export const PEAK_RESOLUTION = 400;

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/** Validates untrusted peak arrays (e.g. from an API body). */
export function sanitizePeaks(input: unknown, max = 2000): number[] | null {
  if (!Array.isArray(input) || input.length < 8 || input.length > max) return null;
  const out = input.map((v) => clamp01(typeof v === "number" ? v : Number(v)));
  return out.some((v) => v > 0) ? out : null;
}

/** Resamples by max-pooling (downsampling) or linear interpolation (upsampling). */
export function resample(peaks: number[], n: number): number[] {
  if (!peaks.length) return new Array(n).fill(0);
  if (peaks.length === n) return peaks.slice();
  const out: number[] = [];
  if (peaks.length > n) {
    const step = peaks.length / n;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * step);
      const b = Math.max(a + 1, Math.floor((i + 1) * step));
      let m = 0;
      let s = 0;
      for (let j = a; j < b && j < peaks.length; j++) {
        m = Math.max(m, peaks[j]);
        s += peaks[j];
      }
      // blend of max and mean keeps shape without jagged single spikes
      out.push(m * 0.7 + (s / (b - a)) * 0.3);
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (peaks.length - 1);
    const a = Math.floor(t);
    const f = t - a;
    out.push(peaks[a] * (1 - f) + (peaks[Math.min(a + 1, peaks.length - 1)] ?? 0) * f);
  }
  return out;
}

/** Normalises to the 97th percentile so one clipped spike can't flatten everything. */
export function normalize(peaks: number[], floor = 0.04): number[] {
  if (!peaks.length) return peaks;
  const sorted = peaks.slice().sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.97)] || sorted[sorted.length - 1] || 1;
  return peaks.map((p) => Math.max(floor, Math.min(1, p / (ref || 1))));
}

export function smooth(peaks: number[], radius = 1): number[] {
  return peaks.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = -radius; j <= radius; j++) {
      const v = peaks[i + j];
      if (v !== undefined) {
        s += v;
        n++;
      }
    }
    return s / n;
  });
}

/** Deterministic PRNG from a string seed (mulberry32 over a string hash). */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plausible sample envelopes for catalogue imagery and previews before a
 * customer adds audio. These imitate the shape of real recordings: speech has
 * syllable bursts and pauses, songs have sustained dynamics, heartbeats pulse.
 */
export function samplePeaks(seed: string, kind: "voice" | "song" | "heartbeat" = "voice", n = PEAK_RESOLUTION): number[] {
  const rand = rng(seed);
  const out: number[] = [];
  if (kind === "heartbeat") {
    const period = 34 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const p = i % period;
      const lub = Math.exp(-((p - 3) ** 2) / 3);
      const dub = 0.65 * Math.exp(-((p - 11) ** 2) / 4);
      out.push(0.05 + lub + dub + rand() * 0.05);
    }
    return normalize(out, 0.03);
  }
  if (kind === "song") {
    // verse → build → chorus dynamics with beat-level variation
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const section = 0.45 + 0.35 * Math.sin(t * Math.PI * 2.2 - 1.2) ** 2 + 0.2 * t;
      const beat = 0.75 + 0.25 * Math.abs(Math.sin(i * 0.9 + rand() * 0.4));
      const fadeIn = Math.min(1, t * 14);
      const fadeOut = Math.min(1, (1 - t) * 10);
      out.push(section * beat * fadeIn * fadeOut * (0.85 + rand() * 0.3));
    }
    return normalize(smooth(out, 1), 0.05);
  }
  // voice: words of 3–9 syllables separated by short pauses
  let i = 0;
  while (i < n) {
    const syllables = 3 + Math.floor(rand() * 7);
    const loud = 0.55 + rand() * 0.45;
    for (let s = 0; s < syllables && i < n; s++) {
      const len = 4 + Math.floor(rand() * 6);
      const peak = loud * (0.55 + rand() * 0.45);
      for (let k = 0; k < len && i < n; k++, i++) {
        const shape = Math.sin((k / (len - 1 || 1)) * Math.PI);
        out.push(0.04 + peak * (0.35 + 0.65 * shape) + rand() * 0.06);
      }
    }
    const pause = 2 + Math.floor(rand() * 8);
    for (let k = 0; k < pause && i < n; k++, i++) out.push(0.02 + rand() * 0.05);
  }
  return normalize(out, 0.03);
}

/**
 * Browser-only: decode an audio Blob into PEAK_RESOLUTION peaks using RMS
 * windows (closer to perceived loudness than raw sample maxima).
 */
export async function decodePeaksFromBlob(blob: Blob, n = PEAK_RESOLUTION): Promise<{ peaks: number[]; duration: number }> {
  const buf = await blob.arrayBuffer();
  const Ctx: typeof AudioContext =
    (globalThis as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).AudioContext ||
    (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch0 = audio.getChannelData(0);
    const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
    const win = Math.max(1, Math.floor(ch0.length / n));
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      const start = i * win;
      const end = Math.min(ch0.length, start + win);
      for (let j = start; j < end; j++) {
        const v = ch1 ? (ch0[j] + ch1[j]) / 2 : ch0[j];
        sum += v * v;
      }
      peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
    }
    return { peaks: normalize(peaks), duration: audio.duration };
  } finally {
    void ctx.close();
  }
}
