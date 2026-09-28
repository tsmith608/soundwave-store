import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://soundwaveart.com";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/order/", "/l/", "/dev/"] }], sitemap: `${base}/sitemap.xml` };
}
