"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/site";

const LINKS = [
  { href: "/designs", label: "The art" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#occasions", label: "Occasions" },
  { href: "/faq", label: "FAQ" },
];

function CartLink({ count, onClick }: { count: number; onClick?: () => void }) {
  return (
    <Link href="/cart" onClick={onClick} className="relative inline-flex h-11 w-11 items-center justify-center" aria-label={count ? `Cart, ${count} item${count > 1 ? "s" : ""}` : "Cart"}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 7h14l-1.5 12h-11z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full border-2 border-ink bg-signal px-1 text-center text-[11px] font-bold leading-4">{count}</span>}
    </Link>
  );
}

function Mark() {
  // A tiny recording envelope — the brand motif at logo size.
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden>
      {[5, 11, 7, 18, 10, 14, 6, 9].map((h, i) => (
        <rect key={i} x={1 + i * 3.1} y={11 - h / 2} width="2" height={h} rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/cart/count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => undefined);
  }, [pathname]);
  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-ink bg-paper/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label={`${BRAND_NAME} home`}>
          <Mark />
          <span className="display text-[22px] !leading-none !tracking-[-0.03em]">{BRAND_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[15px] font-medium hover:bg-ink hover:text-paper">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/account" className="hidden min-h-[44px] items-center px-2 text-[15px] font-medium hover:underline lg:inline-flex">
            Account
          </Link>
          <CartLink count={count} />
          <Link href="/create" className="btn btn-signal !min-h-[44px] !text-sm">
            <span>Create yours</span>
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
        <div className="flex items-center md:hidden">
          <CartLink count={count} />
        <button type="button" onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center" aria-label="Menu" aria-expanded={open}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? <path strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </div>
      {open && (
        <div className="border-t-2 border-ink bg-paper px-4 pb-6 pt-2 md:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="display block py-2.5 text-3xl">
              {l.label}
            </Link>
          ))}
          <Link href="/account" onClick={() => setOpen(false)} className="display block py-2.5 text-3xl">
            Account
          </Link>
          <Link href="/track" onClick={() => setOpen(false)} className="display block py-2.5 text-3xl">
            Track an order
          </Link>
          <Link href="/create" onClick={() => setOpen(false)} className="btn btn-signal mt-4 w-full justify-between">
            <span>Create yours</span>
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
      )}
    </header>
  );
}
