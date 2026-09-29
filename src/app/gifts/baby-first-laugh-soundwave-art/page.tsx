import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Baby's First Laugh Art — From a Phone Video | SoundWave Art",
  description:
    "Turn your baby's first laugh, first word or bedtime babble from a phone video into keepsake nursery art, with a code that plays it back. Framed or print-only.",
  alternates: { canonical: "/gifts/baby-first-laugh-soundwave-art" },
  openGraph: { images: ["/mockups/example-heartbeat.jpg"] },
};

const c: IntentContent = {
  path: "/gifts/baby-first-laugh-soundwave-art",
  world: "botanical",
  eyebrow: "Baby · first laugh",
  h1: "Six seconds of laughing, kept for good.",
  intro: [
    "It's already in your camera roll: the first real belly laugh, the first ‘mama’, the babble in the bath. Upload the video and we turn its sound into a finished print — a botanical grown from the laugh, or the moon on the day it happened.",
    "Babies change every week. The print holds the sound of this one.",
  ],
  occasion: "baby",
  examples: [
    { designId: "herbarium", colorwayId: "blush", kind: "voice", seed: "laugh-1", frame: "natural", caption: "", fields: { title: "Ada's first laugh", subtitle: "Phone video · 4 months", names: "Ada Rose", date: "2026-02-11", message: "At the dog. Obviously.", song: "" } },
    { designId: "night-of", colorwayId: "dawn", kind: "voice", seed: "laugh-2", frame: "white", caption: "the moon on the night of the first word.", fields: { date: "2026-06-21", names: "Sami", title: "His first word, from the bath video", message: "It was ‘duck’.", subtitle: "", song: "" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "laugh-3", frame: "black", caption: "Herbarium colourway, for a grown-up room.", fields: { title: "The twins, laughing", subtitle: "Kitchen video · 9 months", names: "June & Bea", date: "2025-11-30", message: "", song: "" } },
  ],
  howToTitle: "Finding the right clip",
  howTo: [
    { title: "Search your camera roll", body: "Photos can search for ‘baby’ or a month. Look for the clips where you can hear them clearly over the room." },
    { title: "Trim to the moment", body: "Trim in your Photos app to the laugh or the word — a few seconds is plenty, up to 3 minutes." },
    { title: "Upload the video", body: "No converting. Your browser pulls out the sound and only the sound is uploaded." },
  ],
  considerations: [
    { title: "Your voice is in it too", body: "The parent laughing along is usually part of the magic. If you want the baby alone, trim to where they're loudest." },
    { title: "Name and date", body: "Add the name, the date and a short line about what made them laugh — it's the part people read first." },
  ],
  faqs: [
    { q: "Can I use a clip someone else filmed?", a: "Yes, if it's your family's video and they're happy for you to use it." },
    { q: "Does the code play the video?", a: "It plays the sound only. We never receive the footage." },
    { q: "What if the laugh is very short?", a: "Even two or three seconds works — the design is scaled to the recording's length." },
  ],
  ctaLabel: "Make a first-laugh print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
