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
    ];
  },
};

export default nextConfig;
