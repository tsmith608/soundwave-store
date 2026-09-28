import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SoundWave Art — Turn Any Sound into Custom Framed Wall Art",
  description:
    "Transform wedding vows, baby heartbeats, or favorite songs into museum-quality framed sound wave wall art. Gift-ready, handcrafted custom prints starting from $49.",
  keywords: [
    "sound wave art",
    "soundwave wall art",
    "custom sound print",
    "wedding vows art",
    "baby heartbeat art",
    "custom framed print",
  ],
  openGraph: {
    title: "SoundWave Art — Turn Any Sound into Custom Framed Wall Art",
    description: "Transform your audio recording into museum-quality framed sound wave wall art from $49.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} ${cormorant.variable} bg-[#FAF7F2] text-[#2D2A26] min-h-screen flex flex-col antialiased`}>
        {children}
      </body>
    </html>
  );
}
