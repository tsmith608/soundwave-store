import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Baby Heartbeat Art — From Your Scan Video | SoundWave Art",
  description:
    "Turn the heartbeat from your ultrasound or Doppler video into a quiet nursery print. Upload the clip from your phone; we use its sound, not the footage. Framed or print-only.",
  alternates: { canonical: "/gifts/first-baby-heartbeat-soundwave-art" },
  openGraph: { images: ["/mockups/example-heartbeat.jpg"] },
};

const c: IntentContent = {
  world: "romantic",
  eyebrow: "Baby · heartbeat",
  h1: "The first sound you heard of them.",
  intro: [
    "Most parents have a short phone video from the scan — the room goes quiet, then that fast, galloping heartbeat. Upload the clip and Herbarium grows it into a botanical: every leaf is a moment of the heartbeat, with their name and the date on a specimen label.",
    "Scan the code on the print and the heartbeat plays again — for you, for the grandparents, for them one day.",
  ],
  occasion: "baby",
  examples: [
    { designId: "herbarium", colorwayId: "blush", kind: "heartbeat", seed: "hb-1", frame: "white", caption: "", fields: { title: "Olive", subtitle: "20-week scan video", names: "Mom & Dad", date: "2026-03-14", message: "One hundred and fifty beats a minute.", song: "" } },
    { designId: "night-of", colorwayId: "dawn", kind: "heartbeat", seed: "hb-2", frame: "natural", caption: "the moon on the day of the scan — or the day they arrived.", fields: { date: "2026-08-02", names: "Theo", title: "His heartbeat, from the scan video", message: "", subtitle: "", song: "" } },
    { designId: "herbarium", colorwayId: "cyanotype", kind: "heartbeat", seed: "hb-3", frame: "black", caption: "Cyanotype colourway, for a calmer nursery.", fields: { title: "Baby Nguyen", subtitle: "Home Doppler · 24 weeks", names: "For Grandma", date: "2026-05-09", message: "", song: "" } },
  ],
  howToTitle: "Getting the heartbeat",
  howTo: [
    { title: "A scan video", body: "The clip you filmed at the appointment is perfect. Upload it as it is — your browser pulls out the sound and only the sound is uploaded." },
    { title: "Ask the clinic", body: "Some clinics will give you a recording of the heartbeat if you ask at the appointment. Any audio file works." },
    { title: "Home Doppler", body: "Record the Doppler's speaker with your phone's voice memo app in a quiet room — 10 to 30 seconds is plenty." },
  ],
  considerations: [
    { title: "Short is fine", body: "A few seconds of heartbeat gives a full, even plant. Trim long clips to the part you want (up to 3 minutes)." },
    { title: "Background voices", body: "Talking in the room shapes the leaves too. If you want the heartbeat alone, trim to a quiet stretch in your Photos app first." },
    { title: "A gift for grandparents", body: "Choose the code and they can hear it from their own phone — no app needed." },
  ],
  faqs: [
    { q: "Is my scan video uploaded?", a: "No. Your browser extracts the soundtrack on your device and only the sound is sent to us. The footage never leaves your phone." },
    { q: "Can you add the baby's name later?", a: "The name is printed, so add it when you order. If you'd like to wait, order after the birth — the heartbeat recording keeps." },
    { q: "Is it private?", a: "The code opens an unlisted page only people with the print can reach, and you can ask us to remove the recording at any time." },
  ],
  ctaLabel: "Make a heartbeat print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
