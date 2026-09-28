"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Adds `is-in` when the element scrolls into view. Content is in the DOM and
 * readable from the start; without JS or with reduced motion it simply shows.
 */
export default function Reveal({ children, className = "", as: Tag = "div", delay = 0, variant = "reveal" }: { children: React.ReactNode; className?: string; as?: React.ElementType; delay?: number; variant?: "reveal" | "grow-up" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`${variant} ${inView ? "is-in" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms`, animationDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}
