"""Original soundtracks for the Afterhum videos (synthesised, so no licence questions).

Soft felt piano + warm pad in D major, chords changing on the scene cuts, with
in-key chimes and muted typing/click effects placed in the same reverb space.

    python3 scripts/marketing/brag_audio.py                 # launch film → marketing/brag-output/work/soundtrack.wav
    python3 scripts/marketing/brag_audio.py night-of OUT.wav
    python3 scripts/marketing/brag_audio.py herbarium OUT.wav

Cue times mirror scripts/marketing/brag.ts and scripts/marketing/verticals.ts.
"""
import os
import sys
import wave

import numpy as np

SR = 44100

DMAJ9 = [50, 57, 61, 64, 66]
BM11 = [47, 54, 57, 62, 64]
GMAJ7 = [43, 50, 54, 59, 62]
EM9 = [40, 47, 55, 62, 66]
GMAJ9 = [43, 50, 54, 57, 59]
ASUS4 = [45, 52, 57, 62, 64]
BM7 = [47, 54, 57, 62, 66]
AADD9 = [45, 52, 57, 61, 64]
DMAJ9_END = [38, 45, 54, 61, 64, 69]


def typing(t0, n, step=0.09):
    return [t0 + i * step for i in range(1, n + 1)]


CUES = {
    "launch": {
        "dur": 21.5,
        "chords": [(0.0, DMAJ9), (3.4, BM11), (7.6, GMAJ7), (10.3, EM9), (13.0, GMAJ9), (15.25, ASUS4), (16.8, BM7), (18.0, AADD9), (19.2, DMAJ9_END)],
        "ticks": typing(8.7, 20),
        "thumps": [11.66],
        "bells": [(6.9, 81, 0.06), (15.25, 78, 0.06), (19.35, 74, 0.07)],
    },
    "night-of": {
        "dur": 20.0,
        "chords": [(0.0, DMAJ9), (3.4, BM11), (8.2, GMAJ7), (10.4, EM9), (12.6, GMAJ9), (14.5, ASUS4), (16.4, DMAJ9_END)],
        "ticks": [],
        "thumps": [],
        "bells": [(6.24, 78, 0.06), (13.0, 79, 0.03), (13.25, 81, 0.03), (13.5, 83, 0.03), (16.6, 74, 0.07)],
    },
    "herbarium": {
        "dur": 20.0,
        "chords": [(0.0, DMAJ9), (3.4, BM11), (8.4, GMAJ7), (10.8, EM9), (13.2, GMAJ9), (15.0, ASUS4), (16.6, DMAJ9_END)],
        "ticks": typing(9.4, 20),
        "thumps": [12.06],
        "bells": [(6.95, 81, 0.06), (13.5, 79, 0.03), (13.75, 81, 0.03), (14.0, 83, 0.03), (14.25, 86, 0.03), (16.8, 74, 0.07)],
    },
}


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(f, length, vel):
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for k in range(1, 9):
        inharm = 1 + 0.0004 * k * k
        amp = vel / k ** 1.6  # felt: soft upper partials
        out += amp * np.sin(2 * np.pi * f * k * inharm * t) * np.exp(-t * (0.55 + 0.85 * k))
    return out * np.minimum(1, t / 0.006)


def bell(f, length, vel):
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 1.4), (2.0, 0.35, 2.2), (2.76, 0.22, 3.0), (5.4, 0.08, 5.0)]:
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return vel * out * np.minimum(1, t / 0.004)


def pad(freqs, length):
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            out += np.sin(2 * np.pi * (f + det) * t) + 0.25 * np.sin(2 * np.pi * 2 * (f + det) * t)
    env = np.minimum(1, t / 0.9) * np.minimum(1, (length - t) / 0.8)
    return out * env / len(freqs)


def compose(cue, out):
    rng = np.random.default_rng(7)
    dur = cue["dur"]
    n_samples = int(SR * dur)
    L = np.zeros(n_samples)
    R = np.zeros(n_samples)

    def place(sig, at, pan=0.0):
        i = int(at * SR)
        j = min(n_samples, i + len(sig))
        if j <= i:
            return
        seg = sig[: j - i]
        L[i:j] += seg * np.sqrt((1 - pan) / 2)
        R[i:j] += seg * np.sqrt((1 + pan) / 2)

    def tick(vel):
        t = np.arange(int(SR * 0.03)) / SR
        noise = np.convolve(rng.standard_normal(len(t)), np.ones(6) / 6, mode="same")  # take the edge off
        body = np.sin(2 * np.pi * 1760 * t) * 0.4  # A6, in key
        return vel * (noise * 0.6 + body) * np.exp(-t * 260)

    def thump(vel):
        t = np.arange(int(SR * 0.12)) / SR
        return vel * (np.sin(2 * np.pi * 147 * t) * np.exp(-t * 40) + 0.3 * np.sin(2 * np.pi * 587 * t) * np.exp(-t * 90))

    chords = cue["chords"]
    ends = [c[0] for c in chords[1:]] + [dur]
    for (at, notes), end in zip(chords, ends):
        for n, m in enumerate(notes):  # rolled chord
            place(piano(midi(m), min(5.0, dur - at), 0.22 if m > 52 else 0.28) * (0.9 if m < 50 else 1), at + n * 0.03)
        top = sorted(notes)[-3:]  # sparse arpeggio of upper chord tones, an octave up
        k = 0
        t = at + 0.84
        while t < end - 0.3 and t < dur - 1.2:
            place(piano(midi(top[k % 3] + 12), 2.5, 0.085), t, pan=-0.25 + 0.25 * (k % 3))
            k += 1
            t += 0.84
        p = pad([midi(m) for m in notes[1:4]], end - at + 0.8) * 0.05
        place(p * np.sqrt(2), at)

    for t in cue["ticks"]:
        place(tick(0.035 + 0.01 * rng.random()), t, pan=0.3)
    for t in cue["thumps"]:
        place(thump(0.12), t, pan=0.35)
    for t, m, vel in cue["bells"]:
        place(bell(midi(m), 3.0, vel), t, pan=0.0)

    def ir(seed):  # one shared room: simple stereo reverb
        r = np.random.default_rng(seed)
        t = np.arange(int(SR * 2.2)) / SR
        x = r.standard_normal(len(t)) * np.exp(-t / 0.5)
        return np.convolve(x, np.ones(12) / 12, mode="same") * 0.02

    def conv(x, h):
        n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
        return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]

    mixL = L * 0.8 + conv(L, ir(1)) * 0.9
    mixR = R * 0.8 + conv(R, ir(2)) * 0.9

    t = np.arange(n_samples) / SR  # fades + gentle limiting
    env = np.minimum(1, t / 0.08) * np.clip((dur - t) / 1.6, 0, 1)
    mix = np.stack([mixL, mixR], axis=1) * env[:, None]
    mix /= np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.6

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype("<i2").tobytes())
    print("audio", out, f"{dur}s")


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "launch"
    default_out = os.path.join("marketing", "brag-output", "work", "soundtrack.wav")
    compose(CUES[name], sys.argv[2] if len(sys.argv) > 2 else default_out)
