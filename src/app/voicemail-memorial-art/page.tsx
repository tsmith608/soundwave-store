import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Voicemail Memorial Art — Keep Their Voice | ${BRAND_NAME}`,
  description:
    "Turn a saved voicemail or voice note from someone you've lost into a quiet, finished memorial print — with their words set beneath and a code that plays their voice.",
  alternates: { canonical: "/voicemail-memorial-art" },
  openGraph: { images: ["/mockups/example-voicemail.jpg"] },
};

const c: IntentContent = {
  path: "/voicemail-memorial-art",
  world: "romantic",
  eyebrow: "Voicemail & voice memorial",
  h1: "Keep their voice where you can see it.",
  intro: [
    "A voicemail is often the only recording people have of someone's everyday voice. Herbarium grows their voice into a quiet pressed botanical — every leaf a moment of the message — with their name and the words they actually said on a specimen label. No hearts, doves or stock phrases.",
    "Scan the code on the print and the message plays, from any phone, for anyone in the family.",
  ],
  occasion: "memorial",
  examples: [
    { designId: "herbarium", colorwayId: "stone", kind: "voice", seed: "vm-1", frame: "white", caption: "", fields: { title: "Walter James Brennan", subtitle: "Voicemail · 11 March 2021", names: "His children", date: "1938 — 2025", message: "Hey kiddo, it's Dad. Just wanted to hear your voice." } },
    { designId: "night-of", colorwayId: "midnight", kind: "voice", seed: "vm-2", frame: "black", caption: "the moon on the night they were born — or the night you lost them.", fields: { date: "1946-11-02", names: "Nana", title: "Her birthday message, 2019", message: "I'm so proud of you, my darling girl.", subtitle: "" } },
    { designId: "herbarium", colorwayId: "herbarium", kind: "voice", seed: "vm-3", frame: "natural", caption: "Herbarium colourway, for warmer rooms.", fields: { title: "Marcus Reid", subtitle: "Voice note · Summer 2023", names: "Always", date: "1979 — 2024", message: "Race you to the end of the pier." } },
  ],
  howToTitle: "Saving the voicemail from your phone",
  howTo: [
    { title: "iPhone", body: "Phone app → Voicemail → tap the message → Share → Save to Files (or AirDrop/email it to yourself). Then upload that file in the studio." },
    { title: "Android", body: "Options differ by carrier. Many visual-voicemail apps have Save or Export. If yours doesn't, play the voicemail on speaker and record it with another phone's voice-memo app, or screen-record while it plays." },
    { title: "Carrier voicemail only?", body: "Call your voicemail from another line and record the call, or ask your carrier to email the message. Do this soon — carriers delete old messages. There is a full step-by-step guide linked in the footer (“How to save a voicemail”)." },
  ],
  considerations: [
    { title: "Short is fine", body: "Even four seconds — “Hi, it's Mom, call me back” — gives a complete, beautiful line. The artwork scales to any length." },
    { title: "Their words", body: "The quote on the print is usually what they said in the recording. Type it exactly as they said it; it doesn't need to be profound." },
    { title: "Background noise", body: "Hiss or road noise is part of the recording and doesn't show in the artwork's shape the way people fear. If you'd like, send us the file and we'll trim silence before printing." },
    { title: "As a sympathy gift", body: "If you're ordering for someone else, ask a family member for the recording quietly — and consider switching the code off if the family may not be ready to hear it." },
  ],
  faqs: [
    { q: "Will the recording stay private?", a: "Yes. It's reachable only from the code on the print or the private link we email you, and we'll delete it whenever you ask." },
    { q: "Can I order copies for my siblings?", a: "Yes — order the same design again with the same recording. Each print gets its own code." },
    { q: "Can I use a video instead?", a: "Yes. Save or screen-record the video and upload it; we use the sound only." },
  ],
  ctaLabel: "Start a memorial print",
};

export default function Page() {
  return <IntentPage c={c} />;
}
