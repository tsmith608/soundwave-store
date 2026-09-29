import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Wedding Vows & First Dance Keepsake Art — From Your Wedding Video | SoundWave Art",
  description:
    "Turn the sound of your wedding video — your vows, the speeches, the first dance as it was filmed — into keepsake wall art. Upload the clip; we use its sound. Framed or print-only.",
  alternates: { canonical: "/wedding-vows-art" },
  openGraph: { images: ["/mockups/example-first-dance.jpg"] },
};

const c: IntentContent = {
  path: "/wedding-vows-art",
  eyebrow: "Wedding vows · first dance · speeches",
  h1: "Your vows, exactly as they sounded that day.",
  world: "botanical",
  intro: [
    "Somewhere on a phone there’s a video of your vows — the pause before “I do”, the laugh from the second row. Upload it and we turn its sound into a finished piece of art for your wall.",
    "Herbarium grows the recording into a pressed botanical. The Night Of draws the moon exactly as it was over your wedding, surrounded by the sound. If a song matters, add its title as a small line.",
  ],
  occasion: "vows",
  examples: [
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "wed-2", frame: "natural", caption: "", fields: { title: "Our vows", subtitle: "Wedding video · Sep 21 2024", names: "Priya & Daniel", date: "2024-09-21", message: "Filmed by her brother from the second row.", song: "" } },
    { designId: "night-of", colorwayId: "midnight", kind: "voice", seed: "wed-3", frame: "black", caption: "the moon over the wedding, surrounded by the first dance as it was filmed.", fields: { date: "2025-08-09", names: "Kate & Tom", title: "Our first dance, from the video", message: "", subtitle: "", song: "At Last — Etta James" } },
    { designId: "herbarium", colorwayId: "cyanotype", kind: "voice", seed: "wed-4", frame: "white", caption: "the best man’s speech, Cyanotype colourway.", fields: { title: "The speech", subtitle: "Phone video · Jun 10 2023", names: "Ana & Luis", date: "2023-06-10", message: "", song: "" } },
    { designId: "night-of", colorwayId: "dawn", kind: "voice", seed: "wed-5", frame: "natural", caption: "the proposal, Dawn colourway.", fields: { date: "2022-10-01", names: "Jess & Morgan", title: "The proposal, filmed by a stranger", message: "She said yes before he finished.", subtitle: "", song: "" } },
  ],
  howToTitle: "Getting the sound of your day",
  howTo: [
    { title: "Find the clip", body: "Your photographer’s video, a guest’s phone, a clip in the group chat — any video from the day. Save it to your phone first." },
    { title: "Upload the video", body: "No need to convert it. Your browser pulls out the soundtrack and only the sound is uploaded. Trim to the moment if it’s longer than 3 minutes." },
    { title: "Add your words", body: "Names, the date, a short line. If a song is part of the story, add its title — it’s printed as context, and your code can open it on Spotify or Apple Music." },
  ],
  considerations: [
    { title: "Which design?", body: "Herbarium if the recording is the heart of it — every leaf is a moment of it. The Night Of if the date is — it draws the real moon over your wedding." },
    { title: "Songs", body: "We make the art from the recording you upload, never from a streaming link. A video of your first dance, filmed in the room, is your own recording of the moment." },
    { title: "Paper anniversary", body: "A print-only order is literally paper — a good first-anniversary gift. The frame can come later." },
  ],
  faqs: [
    { q: "Can the code play our song on Spotify?", a: "Yes — choose ‘opens a link’ and paste the song’s Spotify, Apple Music or YouTube link. The code opens it. By default it plays the recording you uploaded instead." },
    { q: "Can I use a Snapchat or Instagram video?", a: "Yes, once it’s saved to your phone. Upload the video file and we use its sound." },
    { q: "Can I see it before paying?", a: "Yes. The studio preview is drawn from your actual recording and is exactly what we print." },
  ],
  ctaLabel: "Make your wedding piece",
};

export default function Page() {
  return <IntentPage c={c} />;
}
