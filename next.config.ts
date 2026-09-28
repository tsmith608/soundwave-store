import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async redirects() {
    return [
      // Memory-audio pivot: the wedding page is about recordings of the day, not song audio.
      { source: "/wedding-song-art", destination: "/wedding-vows-art", permanent: true },
      // Legacy song-led pSEO pages (owner decision, Sep 2026): three were rewritten
      // in place under /gifts/; the rest point at the page that now covers them.
      { source: "/gifts", destination: "/#occasions", permanent: true },
      { source: "/gifts/:slug(first-dance-song-soundwave-art|wedding-vow-soundwave-art)", destination: "/wedding-vows-art", permanent: true },
      { source: "/gifts/:slug(pet-memorial-soundwave-art)", destination: "/pet-memorial-sound-art", permanent: true },
      { source: "/gifts/:slug(celebration-of-life-memorial-soundwave-art)", destination: "/voicemail-memorial-art", permanent: true },
      { source: "/gifts/:slug(.*-anniversary-soundwave-art)", destination: "/anniversary-sound-wave-gift", permanent: true },
    ];
  },
};

export default nextConfig;
