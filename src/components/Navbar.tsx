"use client";

import React, { useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/designs", label: "Designs" },
  { href: "/#occasions", label: "Occasions" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full bg-[#FAF7F2]/92 backdrop-blur-md border-b border-[#E6DFD6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SoundWave Art home">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            {[4, 10, 6, 14, 8, 11, 5].map((h, i) => (
              <line key={i} x1={2 + i * 3} x2={2 + i * 3} y1={11 - h / 2} y2={11 + h / 2} stroke="#2D2A26" strokeWidth="1.6" strokeLinecap="round" />
            ))}
          </svg>
          <span className="font-serif text-[22px] tracking-tight text-[#2D2A26]">SoundWave Art</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[#4A453F]">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#2D2A26] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/create" className="px-5 py-2.5 rounded-md text-sm bg-[#2D2A26] hover:bg-black text-white transition-colors">
            Create yours
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="md:hidden p-2 text-[#4A453F]" aria-label="Toggle navigation menu" aria-expanded={open}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? <path strokeLinecap="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeWidth={1.6} d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden px-4 pt-2 pb-6 bg-[#FAF7F2] border-b border-[#E6DFD6] space-y-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-base text-[#2D2A26]">
              {l.label}
            </Link>
          ))}
          <Link href="/create" onClick={() => setOpen(false)} className="mt-3 block text-center py-3 rounded-md bg-[#2D2A26] text-white text-sm">
            Create yours
          </Link>
        </div>
      )}
    </header>
  );
}
