import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Anniversary Sound Wave Gift — Your Song or Their Voice as Art | SoundWave Art",
  description:
    "An anniversary gift made from a sound you share: your song, your vows, or a voice note. Finished designs, archival paper, framed or print-only for the paper anniversary.",
  alternates: { canonical: "/anniversary-sound-wave-gift" },
  openGraph: { images: ["/mockups/example-night-we-met.jpg"] },
};

const c: IntentContent = {
  eyebrow: "Anniversary gifts",
  h1: "An anniversary gift made from a sound you share.",
  intro: [
    "Your song, your vows, the voicemail from your first date. We turn it into a finished print — the moon over the night you met, a botanical grown from your song, or an editorial poster of the track — with your names and date.",
    "Year one is the paper anniversary, and a print-only order is exactly that. For any other year, the framed version is ready to hang.",
  ],
  occasion: "anniversary",
  examples: [
    { designId: "night-of", colorwayId: "midnight", kind: "voice", seed: "anniv-1", frame: "black", caption: "", fields: { date: "2019-10-12", names: "Sam & Alex", title: "Our first phone call", message: "Five years of saying goodnight.", subtitle: "" } },
    { designId: "arch", colorwayId: "terracotta", kind: "voice", seed: "anniv-2", frame: "natural", caption: "vows recorded on the day.", fields: { names: "Maya & Theo", date: "2025-05-31", title: "Our vows", subtitle: "Big Sur, California", message: "Home is wherever you're standing." } },
    { designId: "night-of", colorwayId: "dawn", kind: "song", seed: "anniv-3", frame: "white", caption: "Dawn colourway, for lighter rooms.", fields: { date: "2016-04-23", names: "Grace & Owen", title: "Ten years", message: "", subtitle: "" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "song", seed: "anniv-4", frame: "natural", caption: "your song as a pressed botanical.", fields: { title: "Ten years", subtitle: "“Harvest Moon”, Neil Young", names: "Grace & Owen", date: "2016-04-23", message: "Still dancing in the kitchen." } },
  ],
  howToTitle: "Three ways to find the sound",
  howTo: [
    { title: "Your song", body: "The song from your first dance, first date or first road trip. Upload the track or a clip." },
    { title: "Something you said", body: "Vows from the wedding video, a proposal someone filmed, a voice note you've never deleted." },
    { title: "Record it now", body: "Record a new message for them in the browser — why you'd marry them again. The print keeps it for good." },
  ],
  considerations: [
    { title: "Surprising someone?", body: "The Night Of needs only a date to work, so you can make it from a song without asking them for anything." },
    { title: "Timing", body: "Allow 5–9 business days for delivery. If the date is close, order the print-only version or choose a smaller size." },
  ],
  faqs: [
    { q: "What's the paper anniversary gift?", a: "The traditional first-anniversary material is paper; our print-only option is archival fine-art paper, and the framed version includes it too." },
    { q: "Does the moon really match our date?", a: "Yes. The Night Of computes the moon's phase and illumination for the exact date you enter." },
    { q: "Can I add a photo?", a: "The Arch can hold a photo inside its arch; the other designs are made to work without one." },
  ],
  ctaLabel: "Make an anniversary print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
