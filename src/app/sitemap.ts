import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only real, distinct, indexable pages (no thin variants). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["", 1],
    ["/create", 0.9],
    ["/designs", 0.8],
    ["/wedding-vows-art", 0.8],
    ["/voicemail-memorial-art", 0.8],
    ["/anniversary-sound-wave-gift", 0.8],
    ["/pet-memorial-sound-art", 0.7],
    ["/gifts/first-baby-heartbeat-soundwave-art", 0.7],
    ["/gifts/baby-first-laugh-soundwave-art", 0.7],
    ["/gifts/proposal-audio-soundwave-art", 0.7],
    ["/how-to-save-a-voicemail", 0.7],
    ["/faq", 0.6],
    ["/about", 0.5],
    ["/shipping", 0.4],
    ["/returns", 0.4],
    ["/contact", 0.4],
    ["/terms", 0.2],
    ["/privacy", 0.2],
    ["/cookies", 0.2],
  ];
  const now = new Date();
  return pages.map(([p, priority]) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly", priority }));
}
