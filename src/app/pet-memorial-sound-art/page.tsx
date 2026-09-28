import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Pet Memorial Sound Art — Their Bark or Purr as a Print | SoundWave Art",
  description:
    "Keep the sound of a dog's bark or a cat's purr as a quiet memorial print with their name and years, and a code that plays it back.",
  alternates: { canonical: "/pet-memorial-sound-art" },
  openGraph: { images: ["/mockups/example-pet.jpg"] },
};

const c: IntentContent = {
  eyebrow: "Pet memorial",
  h1: "The sound that meant they were home.",
  intro: [
    "A bark at the door, a purr on your lap, the jingle of a collar. Pet memorial prints use the same quiet In Memoriam design we make for people: their name, their years, their sound as one fine line, and a line from you.",
    "Almost everyone has a video of their pet somewhere — that's all you need.",
  ],
  occasion: "pet",
  examples: [
    { designId: "in-memoriam", colorwayId: "stone", kind: "voice", seed: "pet-1", frame: "black", caption: "", fields: { names: "Biscuit", date: "2011 — 2026", subtitle: "Recorded on the back porch", message: "The best boy. The loudest hello.", title: "" } },
    { designId: "in-memoriam", colorwayId: "linen", kind: "voice", seed: "pet-2", frame: "natural", caption: "a cat's purr, Linen colourway.", fields: { names: "Miso", date: "2009 — 2025", subtitle: "Purring, Sunday morning", message: "Seventeen years of warm laps.", title: "" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "pet-3", frame: "white", caption: "a gentler, garden-like alternative.", fields: { title: "Juniper", subtitle: "Her garden bark", names: "The Alvarez family", date: "2026-02-14", message: "Always first to the gate." } },
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
    { q: "Can I include a photo of my pet?", a: "The Arch design can hold a photo. In Memoriam is intentionally type-only so it stays calm on the wall." },
    { q: "How short can the clip be?", a: "A single bark is enough — even a second or two." },
  ],
  ctaLabel: "Make a pet memorial print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
