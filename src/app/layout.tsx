import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
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
  title: "SoundWave Art — Keepsake wall art from your own recordings and videos",
  description:
    "Turn the sound from your own recordings and videos — vows from the wedding video, a saved voicemail, a baby's laugh — into keepsake sound wave art. Two finished designs, archival paper, optional frame, and a code that plays the recording back.",
  keywords: [
    "sound wave art",
    "voice recording art",
    "voicemail keepsake",
    "wedding video keepsake",
    "custom sound wave print",
    "memorial voice art",
  ],
  openGraph: {
    title: "SoundWave Art — Keepsake art from the sound of your memories",
    description: "Upload a voice memo, voicemail or video. We turn its sound into a finished art print you can keep.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2EDE3",
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
      <body className={`${inter.variable} ${cormorant.variable} bg-paper text-ink min-h-screen flex flex-col antialiased grain`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
