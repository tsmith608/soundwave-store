import Link from "next/link";
import React from "react";

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path d="M2 9h13M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
  </svg>
);

type Variant = "signal" | "ink" | "paper";

/** Tactile CTA: bordered block with a separate arrow compartment and a hard shadow. */
export function CTA({
  href,
  children,
  variant = "signal",
  className = "",
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
}) {
  const cls = `btn ${variant === "signal" ? "btn-signal" : variant === "ink" ? "btn-ink" : ""} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      <span className="btn-arrow">
        <Arrow />
      </span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
