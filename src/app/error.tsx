"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Route-level error boundary: never shows a stack trace; reports to Sentry when configured. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void import("@sentry/nextjs").then((S) => S.captureException(error)).catch(() => undefined);
  }, [error]);
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-24 sm:px-8">
      <p className="meta">Something went wrong</p>
      <h1 className="display mt-3 text-5xl">That didn&rsquo;t load properly.</h1>
      <p className="mt-5 text-lg text-ink-soft">
        It&rsquo;s on our side, not yours. Your cart and designs are saved. Try again, and if it keeps happening, <Link href="/contact" className="underline">let us know</Link>
        {error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <div className="mt-8 flex gap-4">
        <button onClick={reset} className="btn btn-ink">
          <span>Try again</span>
        </button>
        <Link href="/" className="meta inline-flex min-h-[44px] items-center underline">
          Home
        </Link>
      </div>
    </main>
  );
}
