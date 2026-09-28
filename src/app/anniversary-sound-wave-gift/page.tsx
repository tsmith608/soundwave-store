import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Anniversary Sound Wave Gift — Your Voice, Vows or Video as Art | SoundWave Art",
  description:
    "An anniversary gift made from a sound you share: your vows, a voice note, a video from the night you met. Finished keepsake art, archival paper, framed or print-only.",
  alternates: { canonical: "/anniversary-sound-wave-gift" },
  openGraph: { images: ["/mockups/example-night-we-met.jpg"] },
};

const c: IntentContent = {
  eyebrow: "Anniversary gifts",
  h1: "An anniversary gift made from a sound you share.",
  world: "night",
  intro: [
    "The voice note from your first date. Your vows. The video from the night you met. Upload it and we turn its sound into a finished print — the moon exactly as it was on your night, or a botanical grown from the recording.",
    "Year one is the paper anniversary, and a print-only order is exactly that. For any other year, the framed version is ready to hang.",
  ],
  occasion: "anniversary",
  examples: [
    { designId: "night-of", colorwayId: "midnight", kind: "voice", seed: "anniv-1", frame: "black", caption: "", fields: { date: "2019-10-12", names: "Sam & Alex", title: "Our first phone call", message: "Five years of saying goodnight.", subtitle: "", song: "" } },
    { designId: "night-of", colorwayId: "plum", kind: "voice", seed: "anniv-2", frame: "natural", caption: "vows from the wedding video, Plum Night colourway.", fields: { date: "2025-05-31", names: "Maya & Theo", title: "Our vows", message: "Home is wherever you're standing.", subtitle: "", song: "" } },
    { designId: "night-of", colorwayId: "dawn", kind: "voice", seed: "anniv-3", frame: "white", caption: "Dawn colourway, for lighter rooms.", fields: { date: "2016-04-23", names: "Grace & Owen", title: "Ten years", message: "", subtitle: "", song: "Harvest Moon — Neil Young" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "anniv-4", frame: "natural", caption: "a voicemail she never deleted, as a pressed botanical.", fields: { title: "Ten years", subtitle: "Voicemail · Apr 2016", names: "Grace & Owen", date: "2016-04-23", message: "Still laughing at the same jokes.", song: "" } },
  ],
  howToTitle: "Three ways to find the sound",
  howTo: [
    { title: "Something you kept", body: "A voice note, a voicemail, a video from a trip or the wedding. Check your camera roll and messages." },
    { title: "Something you said", body: "Vows from the wedding video, a proposal someone filmed, a toast." },
    { title: "Record it now", body: "Record a message for them in the browser — why you’d choose them again. The print keeps it for good." },
  ],
  considerations: [
    { title: "Your song?", body: "Add it as the song behind the memory — it’s printed as a small line, and the code can open it on Spotify or Apple Music. The art itself is made from a recording you upload." },
    { title: "Timing", body: "Allow 5–9 business days for delivery. If the date is close, choose print-only or a smaller size." },
  ],
  faqs: [
    { q: "What's the paper anniversary gift?", a: "The traditional first-anniversary material is paper; our print-only option is archival fine-art paper, and the framed version includes it too." },
    { q: "Does the moon really match our date?", a: "Yes. The Night Of computes the moon's phase and illumination for the exact date you enter." },
    { q: "Can I add a photo?", a: "No — both designs are made to stand on their own as art. The recording and your words are the personal part." },
  ],
  ctaLabel: "Make an anniversary piece",
};

export default function Page() {
  return <IntentPage c={c} />;
}
