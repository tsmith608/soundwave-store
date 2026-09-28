"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#FAF7F2]/92 backdrop-blur-md border-b border-[#EAE3DC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B76E79] via-[#D8C7B5] to-[#8A9A86] p-0.5 shadow-sm group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#FAF7F2] rounded-[10px] flex items-center justify-center gap-[2px]">
              <span className="w-1 h-3 bg-[#B76E79] rounded-full" />
              <span className="w-1 h-5 bg-[#B76E79] rounded-full" />
              <span className="w-1 h-2 bg-[#B76E79] rounded-full" />
              <span className="w-1 h-6 bg-[#B76E79] rounded-full" />
              <span className="w-1 h-3 bg-[#B76E79] rounded-full" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl tracking-tight font-semibold text-[#2D2A26] group-hover:text-[#B76E79] transition-colors">
              SoundWave Art
            </span>
            <span className="text-[10px] tracking-widest uppercase text-[#9E968F] font-mono">
              Acoustic Portrait Studio
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B655F]">
          <Link href="/shop" className="hover:text-[#2D2A26] transition-colors">
            Collections
          </Link>
          <a href="/#how-it-works" className="hover:text-[#2D2A26] transition-colors">
            How It Works
          </a>
          <a href="/#stories" className="hover:text-[#2D2A26] transition-colors">
            Stories
          </a>
          <a href="/#faq" className="hover:text-[#2D2A26] transition-colors">
            FAQ
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/product/custom"
            className="px-5 py-2.5 rounded-xl text-xs uppercase font-bold tracking-wider bg-[#B76E79] hover:bg-[#A05C66] text-white shadow-sm transition-all hover:scale-105"
          >
            Begin Your Portrait
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#6B655F] hover:text-[#2D2A26]"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-6 bg-[#FAF7F2] border-b border-[#EAE3DC] space-y-3">
          <Link
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-[#2D2A26] hover:text-[#B76E79]"
          >
            Collections
          </Link>
          <a
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-[#2D2A26] hover:text-[#B76E79]"
          >
            How It Works
          </a>
          <a
            href="/#stories"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-[#2D2A26] hover:text-[#B76E79]"
          >
            Stories
          </a>
          <a
            href="/#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-[#2D2A26] hover:text-[#B76E79]"
          >
            FAQ
          </a>
          <div className="pt-2">
            <Link
              href="/product/custom"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-[#B76E79] text-white"
            >
              Begin Your Portrait
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
