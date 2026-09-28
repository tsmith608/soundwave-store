import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paths = [
    "",
    "/create",
    "/designs",
    "/wedding-vows-art",
    "/voicemail-memorial-art",
    "/anniversary-sound-wave-gift",
    "/pet-memorial-sound-art",
    "/how-to-save-a-voicemail",
    "/gifts/first-baby-heartbeat-soundwave-art",
    "/gifts/baby-first-laugh-soundwave-art",
    "/gifts/proposal-audio-soundwave-art",
  ];
  return paths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
