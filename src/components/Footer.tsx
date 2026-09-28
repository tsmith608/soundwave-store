import React from "react";
import Link from "next/link";
import EmailCapture from "./EmailCapture";
import { SUPPORT_EMAIL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-[#E6DFD6] bg-[#F3EEE7] text-[#4A453F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4 text-sm">
        <div className="md:col-span-2 max-w-sm">
          <div className="font-serif text-2xl text-[#2D2A26]">SoundWave Art</div>
          <p className="mt-3 leading-relaxed text-[#6B655F]">
            Finished art prints made from the sounds people keep: first-dance songs, vows, voicemails, heartbeats. Printed on archival paper in the US and shipped ready to hang.
          </p>
          <div className="mt-8">
            <EmailCapture source="footer" heading="Holiday cutoff reminder" blurb="We'll email you before the last order date for Christmas delivery." />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#9E968F] mb-3">Make one</div>
          <ul className="space-y-2">
            <li><Link href="/create" className="hover:text-[#2D2A26]">Create yours</Link></li>
            <li><Link href="/designs" className="hover:text-[#2D2A26]">The designs</Link></li>
            <li><Link href="/wedding-song-art" className="hover:text-[#2D2A26]">Wedding song art</Link></li>
            <li><Link href="/voicemail-memorial-art" className="hover:text-[#2D2A26]">Voicemail memorial art</Link></li>
            <li><Link href="/anniversary-sound-wave-gift" className="hover:text-[#2D2A26]">Anniversary gift</Link></li>
            <li><Link href="/pet-memorial-sound-art" className="hover:text-[#2D2A26]">Pet memorial</Link></li>
            <li><Link href="/how-to-save-a-voicemail" className="hover:text-[#2D2A26]">How to save a voicemail</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#9E968F] mb-3">Help</div>
          <ul className="space-y-2">
            <li><Link href="/#how-it-works" className="hover:text-[#2D2A26]">How it works</Link></li>
            <li><Link href="/#faq" className="hover:text-[#2D2A26]">FAQ &amp; shipping</Link></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[#2D2A26]">{SUPPORT_EMAIL}</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-[#E6DFD6] text-xs text-[#9E968F] flex flex-col sm:flex-row gap-2 justify-between">
        <span>© {new Date().getFullYear()} SoundWave Art</span>
        <span>If it arrives damaged or we get it wrong, we reprint it free.</span>
      </div>
    </footer>
  );
}
