import type { Metadata } from "next";
import IntentPage, { type IntentContent } from "@/components/IntentPage";

export const metadata: Metadata = {
  title: "Voicemail Memorial Art — Keep Their Voice | SoundWave Art",
  description:
    "Turn a saved voicemail or voice note from someone you've lost into a quiet, finished memorial print — with their words set beneath and a code that plays their voice.",
  alternates: { canonical: "/voicemail-memorial-art" },
  openGraph: { images: ["/mockups/example-voicemail.jpg"] },
};

const c: IntentContent = {
  eyebrow: "Voicemail & voice memorial",
  h1: "Keep their voice where you can see it.",
  intro: [
    "A voicemail is often the only recording people have of someone's everyday voice. In Memoriam sets their name, their voice as a single fine line, and the words they actually said — no hearts, doves or stock phrases.",
    "Scan the code on the print and the message plays, from any phone, for anyone in the family.",
  ],
  occasion: "memorial",
  examples: [
    { designId: "in-memoriam", colorwayId: "stone", kind: "voice", seed: "vm-1", frame: "white", caption: "", fields: { names: "Walter James Brennan", date: "1938 — 2025", subtitle: "Voicemail · 11 March 2021", message: "Hey kiddo, it's Dad. Nothing important. Just wanted to hear your voice.", title: "" } },
    { designId: "in-memoriam", colorwayId: "linen", kind: "voice", seed: "vm-2", frame: "natural", caption: "Linen colourway, for warmer rooms.", fields: { names: "Nana", date: "Always", subtitle: "Birthday message · 2019", message: "Happy birthday my darling girl, I'm so proud of you.", title: "" } },
    { designId: "in-memoriam", colorwayId: "slate", kind: "voice", seed: "vm-3", frame: "black", caption: "Slate, a darker, stone-like finish.", fields: { names: "Marcus Reid", date: "1979 — 2024", subtitle: "Voice note · Summer 2023", message: "Race you to the end of the pier.", title: "" } },
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
