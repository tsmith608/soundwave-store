import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pet Memorial Sound Art — Their Bark or Purr as a Print | ${BRAND_NAME}`,
  description:
    "Keep the sound of a dog's bark or a cat's purr as a quiet memorial print with their name and years, and a code that plays it back.",
  alternates: { canonical: "/pet-memorial-sound-art" },
  openGraph: { images: ["/mockups/example-pet.jpg"] },
};

const c: IntentContent = {
  path: "/pet-memorial-sound-art",
  world: "botanical",
  eyebrow: "Pet memorial",
  h1: "The sound that meant they were home.",
  intro: [
    "A bark at the door, a purr on your lap, the jingle of a collar. Their sound grows into a pressed botanical — every leaf a moment of the bark or purr — with their name and years on a specimen label, and a line from you.",
    "Almost everyone has a video of their pet somewhere — that's all you need.",
  ],
  occasion: "pet",
  examples: [
    { designId: "herbarium", colorwayId: "stone", kind: "voice", seed: "pet-1", frame: "black", caption: "", fields: { title: "Biscuit", subtitle: "Recorded on the back porch", names: "The Alvarez family", date: "2011 — 2026", message: "The best boy. The loudest hello." } },
    { designId: "herbarium", colorwayId: "cyanotype", kind: "voice", seed: "pet-2", frame: "white", caption: "a cat's purr, Cyanotype colourway.", fields: { title: "Miso", subtitle: "Purring, Sunday morning", names: "Hannah", date: "2009 — 2025", message: "Seventeen years of warm laps." } },
    { designId: "night-of", colorwayId: "dawn", kind: "voice", seed: "pet-3", frame: "natural", caption: "the moon on the day they came home.", fields: { date: "2014-05-03", names: "Juniper", title: "Her garden bark", message: "Always first to the gate.", subtitle: "" } },
  ],
  howToTitle: "Finding their sound",
  howTo: [
    { title: "Search your videos", body: "In your phone's photo library, search “dog” or “cat” — most phones find pet videos automatically. Any clip where you can hear them works." },
    { title: "Save the audio", body: "Upload the video's audio, or simply screen-record the clip playing. Background talking is fine; it's part of the memory." },
    { title: "Add their name", body: "Their name, their years (or just “Good boy”), and a line of your own." },
  ],
  considerations: [
    { title: "No sound recordings?", body: "If there's no clip with their voice, a recording of you saying their name, or their collar tags, still makes a meaningful piece." },
    { title: "As a gift", body: "For a friend who has lost a pet, ask quietly for a video — or choose Herbarium, which reads as a botanical print even without knowing the story." },
  ],
  faqs: [
    { q: "Can I include a photo of my pet?", a: "Not on the print — both designs are made to stay calm on the wall. The code can play their sound for anyone who scans it." },
    { q: "How short can the clip be?", a: "A single bark is enough — even a second or two." },
  ],
  ctaLabel: "Make a pet memorial print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
