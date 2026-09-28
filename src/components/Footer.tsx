import React from "react";
import Link from "next/link";

const SOCIAL_LINKS = [
  {
    label: "TikTok",
    href: "https://tiktok.com/@soundwaveart",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.85a8.18 8.18 0 004.78 1.52V6.92a4.85 4.85 0 01-1.01-.23z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/soundwaveart",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "Pinterest",
    href: "https://pinterest.com/soundwaveart",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#F4EFEB] border-t border-[#EAE3DC] text-xs text-[#6B655F] pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#EAE3DC]">
          {/* Brand */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B76E79] to-[#8A9A86] flex items-center justify-center shadow-sm">
                <div className="flex items-center gap-[2px]">
                  <span className="w-0.5 h-2.5 bg-white rounded-full" />
                  <span className="w-0.5 h-4 bg-white rounded-full" />
                  <span className="w-0.5 h-1.5 bg-white rounded-full" />
                  <span className="w-0.5 h-5 bg-white rounded-full" />
                  <span className="w-0.5 h-2 bg-white rounded-full" />
                </div>
              </div>
              <div>
                <span className="font-serif text-lg font-bold text-[#2D2A26] block tracking-wide">
                  SoundWave Art
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#9E968F] font-mono">
                  Acoustic Portrait Studio
                </span>
              </div>
            </div>

            <p className="text-[#6B655F] max-w-sm leading-relaxed text-xs sm:text-sm">
              We transform voices, vows, heartbeats, and songs into museum-grade
              framed acoustic art. Every portrait ships with an archival fine-art
              print, a real wood frame, and a scannable QR code that plays the
              moment back.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 pt-1">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-8 h-8 rounded-lg bg-white border border-[#EAE3DC] flex items-center justify-center text-[#6B655F] hover:text-[#B76E79] hover:border-[#B76E79]/40 transition-all"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3 space-y-4">
            <p className="text-xs uppercase font-bold text-[#2D2A26] tracking-wider">
              Studio
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/shop" className="hover:text-[#B76E79] transition-colors">
                  Browse Collections
                </Link>
              </li>
              <li>
                <Link href="/product/custom" className="hover:text-[#B76E79] transition-colors">
                  Bespoke Studio
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-[#B76E79] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-[#B76E79] transition-colors">
                  FAQ & Support
                </a>
              </li>
            </ul>
          </div>

          {/* Promise */}
          <div className="md:col-span-4 space-y-4">
            <p className="text-xs uppercase font-bold text-[#2D2A26] tracking-wider">
              Our Promise
            </p>
            <ul className="space-y-2.5">
              {[
                "Personal Photo + Soundwave in every print",
                "240+ GSM archival fine-art paper",
                "Solid hardwood frame, ready to hang",
                "Scannable audio QR code included",
                "Free insured US delivery",
                "Happiness guarantee — we make it right",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[#6B655F]">
                  <svg
                    className="w-3.5 h-3.5 text-[#B76E79] shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#9E968F]">
          <p>© {new Date().getFullYear()} SoundWave Art. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/#faq" className="hover:text-[#2D2A26] transition-colors">
              Privacy Policy
            </a>
            <a href="/#faq" className="hover:text-[#2D2A26] transition-colors">
              Terms of Service
            </a>
            <a href="/#faq" className="hover:text-[#2D2A26] transition-colors">
              Shipping & Returns
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
