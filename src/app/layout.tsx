import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import Analytics from "@/components/Analytics";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "SoundWave Art — Your song, vows or a voice you love, as art for the wall",
  description:
    "Turn a first-dance song, wedding vows or a voicemail into a finished art print. Five designs, archival paper, optional frame, and a code that plays the recording back.",
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
        <Analytics />
      </body>
    </html>
  );
}
