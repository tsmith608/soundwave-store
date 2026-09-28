import React from "react";
import Link from "next/link";
import EmailCapture from "./EmailCapture";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-ink text-paper on-dark">
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-16 sm:px-8">
        <p className="display text-[13vw] leading-[0.82] sm:text-[9vw] lg:text-[128px]">
          Keep the <span className="accent !font-normal">sound</span> of it.
        </p>
        <div className="mt-14 grid gap-12 text-sm md:grid-cols-12">
          <div className="md:col-span-5">
            <EmailCapture source="footer" heading="Holiday cutoff reminder" blurb="One email before the last order date for Christmas delivery, then occasional news." dark />
          </div>
          <div className="md:col-span-3 md:col-start-7">
            <div className="meta mb-3 opacity-60">Make one</div>
            <ul>
              <li><Link href="/create" className="inline-flex min-h-[44px] items-center hover:underline">Create your piece</Link></li>
              <li><Link href="/designs" className="inline-flex min-h-[44px] items-center hover:underline">The Night Of &amp; Herbarium</Link></li>
              <li><Link href="/wedding-vows-art" className="inline-flex min-h-[44px] items-center hover:underline">Wedding vows &amp; first dance</Link></li>
              <li><Link href="/voicemail-memorial-art" className="inline-flex min-h-[44px] items-center hover:underline">Voicemail keepsakes</Link></li>
              <li><Link href="/anniversary-sound-wave-gift" className="inline-flex min-h-[44px] items-center hover:underline">Anniversary gifts</Link></li>
              <li><Link href="/pet-memorial-sound-art" className="inline-flex min-h-[44px] items-center hover:underline">Pet memorial</Link></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <div className="meta mb-3 opacity-60">Help</div>
            <ul>
              <li><Link href="/#how-it-works" className="inline-flex min-h-[44px] items-center hover:underline">How it works</Link></li>
              <li><Link href="/#faq" className="inline-flex min-h-[44px] items-center hover:underline">FAQ &amp; shipping</Link></li>
              <li><Link href="/how-to-save-a-voicemail" className="inline-flex min-h-[44px] items-center hover:underline">How to save a voicemail</Link></li>
              <li><a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-[44px] items-center hover:underline">{SUPPORT_EMAIL}</a></li>
            </ul>
          </div>
        </div>
        <div className="meta mt-14 flex flex-col justify-between gap-2 border-t border-white/20 pt-6 opacity-70 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <span className="flex flex-wrap items-center gap-x-5">
            <Link href="/terms" className="inline-flex min-h-[44px] items-center hover:underline">Terms</Link>
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center hover:underline">Privacy</Link>
            <span>Damaged or not as previewed? We reprint it free.</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
