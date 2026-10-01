"""Original soundtrack for the Afterhum launch video (synthesised, so no licence questions).

Soft felt piano + warm pad in D major, chords changing on the scene cuts, with
in-key chimes and muted typing/click effects placed in the same reverb space.
Writes marketing/brag-output/work/soundtrack.wav (44.1 kHz, 16-bit stereo).
Timings mirror scripts/marketing/brag.ts.
"""
import os
import wave

import numpy as np

SR = 44100
DUR = 21.5
N = int(SR * DUR)
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def piano(f, length, vel):
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for k in range(1, 9):
        inharm = 1 + 0.0004 * k * k
        amp = vel / k ** 1.6  # felt: soft upper partials
        out += amp * np.sin(2 * np.pi * f * k * inharm * t) * np.exp(-t * (0.55 + 0.85 * k))
    attack = np.minimum(1, t / 0.006)
    return out * attack


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


def tick(vel):
    t = np.arange(int(SR * 0.03)) / SR
    noise = rng.standard_normal(len(t))
    noise = np.convolve(noise, np.ones(6) / 6, mode="same")  # take the edge off
    body = np.sin(2 * np.pi * 1760 * t) * 0.4  # A6, in key
    return vel * (noise * 0.6 + body) * np.exp(-t * 260)


def thump(vel):
    t = np.arange(int(SR * 0.12)) / SR
    return vel * (np.sin(2 * np.pi * 147 * t) * np.exp(-t * 40) + 0.3 * np.sin(2 * np.pi * 587 * t) * np.exp(-t * 90))


L = np.zeros(N)
R = np.zeros(N)


def place(sig, at, pan=0.0):
    i = int(at * SR)
    j = min(N, i + len(sig))
    seg = sig[: j - i]
    L[i:j] += seg * np.sqrt((1 - pan) / 2)
    R[i:j] += seg * np.sqrt((1 + pan) / 2)


CHORDS = [
    (0.0, [50, 57, 61, 64, 66]),  # Dmaj9
    (3.4, [47, 54, 57, 62, 64]),  # Bm11
    (7.6, [43, 50, 54, 59, 62]),  # Gmaj7
    (10.3, [40, 47, 55, 62, 66]),  # Em9
    (13.0, [43, 50, 54, 57, 59]),  # Gmaj9
    (15.25, [45, 52, 57, 62, 64]),  # Asus4 (date lands)
    (16.8, [47, 54, 57, 62, 66]),  # Bm7
    (18.0, [45, 52, 57, 61, 64]),  # A(add9)
    (19.2, [38, 45, 54, 61, 64, 69]),  # Dmaj9, ring out
]
ends = [c[0] for c in CHORDS[1:]] + [DUR]

pianoL = np.zeros(N)
padSig = np.zeros(N)
for (at, notes), end in zip(CHORDS, ends):
    for n, m in enumerate(notes):  # rolled chord
        sig = piano(midi(m), min(5.0, DUR - at), 0.22 if m > 52 else 0.28)
        i = int((at + n * 0.03) * SR)
        j = min(N, i + len(sig))
        pianoL[i:j] += sig[: j - i] * (0.9 if m < 50 else 1)
    # sparse arpeggio of upper chord tones, an octave up
    top = sorted(notes)[-3:]
    k = 0
    t = at + 0.84
    while t < end - 0.3 and t < DUR - 1.2:
        m = top[k % 3] + 12
        place(piano(midi(m), 2.5, 0.085), t, pan=-0.25 + 0.25 * (k % 3))
        k += 1
        t += 0.84
    p = pad([midi(m) for m in notes[1:4]], end - at + 0.8)
    i = int(at * SR)
    j = min(N, i + len(p))
    padSig[i:j] += p[: j - i] * 0.05

place(pianoL, 0.0)
L += padSig
R += padSig

# effects, in key and under the music
for i in range(1, 21):  # typing "Walter James Brennan"
    place(tick(0.035 + 0.01 * rng.random()), 8.7 + i * 0.09, pan=0.3)
place(thump(0.12), 11.66, pan=0.35)  # Add to cart
place(bell(midi(81), 3.0, 0.06), 6.9, pan=0.2)  # plant finishes growing (A5)
place(bell(midi(78), 3.0, 0.06), 15.25, pan=-0.2)  # date lands (F#5)
place(bell(midi(74), 3.5, 0.07), 19.35)  # logo (D5)

# one shared room: simple stereo reverb
def ir(seed):
    r = np.random.default_rng(seed)
    t = np.arange(int(SR * 2.2)) / SR
    x = r.standard_normal(len(t)) * np.exp(-t / 0.5)
    return np.convolve(x, np.ones(12) / 12, mode="same") * 0.02


def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]


wetL = conv(L, ir(1))
wetR = conv(R, ir(2))
mixL = L * 0.8 + wetL * 0.9
mixR = R * 0.8 + wetR * 0.9

# fades + gentle limiting
t = np.arange(N) / SR
env = np.minimum(1, t / 0.08) * np.clip((DUR - t) / 1.6, 0, 1)
mix = np.stack([mixL, mixR], axis=1) * env[:, None]
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.6

out = os.path.join("marketing", "brag-output", "work", "soundtrack.wav")
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("audio", out, f"{DUR}s")
