import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Proposal Keepsake Art — The ‘Yes’ From Your Video | SoundWave Art",
  description:
    "Someone filmed the proposal. Turn the sound of it — the question, the yes, the cheering — into keepsake art with the moon exactly as it was that night. Framed or print-only.",
  alternates: { canonical: "/gifts/proposal-audio-soundwave-art" },
  openGraph: { images: ["/mockups/wall-night-of.jpg"] },
};

const c: IntentContent = {
  world: "night",
  eyebrow: "Proposal · engagement",
  h1: "The question, the yes, and the moon that night.",
  intro: [
    "If someone filmed it, you have the whole moment: the nervous start, the question, the gasp, the yes, the friends cheering in the background. Upload that video and The Night Of surrounds the moon — exactly as it was on your date — with the sound of it.",
    "An engagement gift, a wedding-day surprise, or a first-anniversary present (year one is paper).",
  ],
  occasion: "anniversary",
  examples: [
    { designId: "night-of", colorwayId: "midnight", kind: "voice", seed: "prop-1", frame: "black", caption: "", fields: { date: "2025-12-31", names: "Priya & Daniel", title: "She said yes, filmed by her sister", message: "Top of the hill, 11:52 pm.", subtitle: "", song: "" } },
    { designId: "night-of", colorwayId: "plum", kind: "voice", seed: "prop-2", frame: "natural", caption: "Plum Night colourway.", fields: { date: "2026-02-14", names: "Lou & Kit", title: "The proposal, from the video", message: "", subtitle: "", song: "" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "prop-3", frame: "natural", caption: "Herbarium, grown from the ‘yes’.", fields: { title: "Yes.", subtitle: "Proposal video · Lake Tahoe", names: "Sam & Riley", date: "2026-07-04", message: "Nobody could hear the question over the cheering.", song: "" } },
  ],
  howToTitle: "Making it from the video",
  howTo: [
    { title: "Get the clip", body: "Ask whoever filmed it to send the original (AirDrop or a shared album keeps the quality better than a messaging app)." },
    { title: "Trim to the moment", body: "Start a few seconds before the question and stop after the cheering — up to 3 minutes." },
    { title: "Add the date and place", body: "The Night Of computes the moon for your exact date. Add names and a line about where it happened." },
  ],
  considerations: [
    { title: "Music in the background?", body: "Fine — we only use your video's sound to shape the art and to play it back privately through your code. If there's a song you want remembered, add its title as a line on the print." },
    { title: "Keeping it a surprise", body: "Order it yourself and choose print-only if you'd rather choose the frame together." },
  ],
  faqs: [
    { q: "Does the moon really match our date?", a: "Yes. The Night Of computes the moon's phase and illumination for the exact date you enter." },
    { q: "Can the code play the video?", a: "It plays the sound. We only ever receive the sound — the footage stays on your phone." },
    { q: "What if nobody filmed it?", a: "Record the two of you telling the story now, or use a voice note from that night. It's your recording of the moment that matters." },
  ],
  ctaLabel: "Make a proposal print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
