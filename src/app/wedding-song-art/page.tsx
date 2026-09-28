import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Wedding Song Wall Art — Your First Dance as a Print | SoundWave Art",
  description:
    "Turn your first-dance song into a finished art print: the song's real sound shape, your names and date, and a code that plays it. Five designs, framed or print-only.",
  alternates: { canonical: "/wedding-song-art" },
  openGraph: { images: ["/mockups/example-first-dance.jpg"] },
};

const c: IntentContent = {
  eyebrow: "First dance & wedding song art",
  h1: "The song you danced to, typeset like it deserves.",
  intro: [
    "Most wedding-song prints are a waveform in a thin border with a script font underneath. Ours are finished artworks: a pressed botanical whose leaves are grown from your song, or the moon exactly as it was on your wedding night, ringed by it.",
    "The shape is drawn from the actual audio you upload, not a generic wave, and an optional code on the print plays the song back.",
  ],
  occasion: "wedding",
  examples: [
    { designId: "herbarium", colorwayId: "herbarium", kind: "song", seed: "wed-2", frame: "natural", caption: "", fields: { title: "Our first dance", subtitle: "“Can't Help Falling in Love”, Elvis Presley", names: "Priya & Daniel", date: "2024-09-21", message: "Pressed from the song we danced to." } },
    { designId: "night-of", colorwayId: "midnight", kind: "song", seed: "wed-3", frame: "black", caption: "the moon exactly as it was over your wedding, ringed by your song.", fields: { date: "2025-08-09", names: "Kate & Tom", title: "“At Last” — Etta James", message: "", subtitle: "" } },
    { designId: "herbarium", colorwayId: "cyanotype", kind: "song", seed: "wed-4", frame: "white", caption: "Cyanotype colourway, like a sun-print.", fields: { title: "La Vie en Rose", subtitle: "Louis Armstrong", names: "Ana & Luis", date: "2023-06-10", message: "" } },
    { designId: "night-of", colorwayId: "dawn", kind: "song", seed: "wed-5", frame: "natural", caption: "Dawn colourway, for lighter rooms.", fields: { date: "2022-10-01", names: "Jess & Morgan", title: "“Lover” — Taylor Swift", message: "Our first dance, under this moon.", subtitle: "" } },
  ],
  howToTitle: "Getting the song into the studio",
  howTo: [
    { title: "Use the audio file if you have it", body: "An MP3 or M4A of the song gives the cleanest shape. A clip is fine — the chorus you actually danced to often looks better than the full track." },
    { title: "Or the video from the day", body: "Wedding videos work too: save the video's audio (or screen-record it on your phone) and upload that. You'll hear the room — that's part of it." },
    { title: "Check the words", body: "Song title, artist, your names and the date. We print exactly what's in the preview, so it's worth a second look at spelling." },
  ],
  considerations: [
    { title: "Which design?", body: "Herbarium if the song is the heart of it — every leaf is a moment of the track. The Night Of if the date is — it shows the real moon over your wedding, and the song rings it." },
    { title: "Lyrics", body: "We don't print full song lyrics: they're copyrighted, and the designs are built around a single line of your own words instead. A title, artist and a short note are fine." },
    { title: "Paper anniversary", body: "A print-only order is literally paper — and the frame can come later. It's a good first-anniversary gift." },
  ],
  faqs: [
    { q: "Can the code play our song on Spotify?", a: "The code plays the audio you upload, hosted privately by us — so it works for anyone, with no app or subscription, and it can be a clip from your own wedding video." },
    { q: "How long can the song be?", a: "Any length. The artwork takes the whole recording's shape, whether it's 20 seconds or four minutes." },
    { q: "Can I see it before paying?", a: "Yes — the studio preview is the exact file we print, drawn from your audio." },
  ],
  ctaLabel: "Make your wedding song print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
