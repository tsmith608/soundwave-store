"use client";

import { useEffect } from "react";

/** Last-resort boundary (root layout failed). Plain HTML, no dependencies. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void import("@sentry/nextjs").then((S) => S.captureException(error)).catch(() => undefined);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F2EDE3", color: "#151412", padding: "48px 20px" }}>
        <h1>Something went wrong.</h1>
        <p>Please try again. Your cart and designs are saved.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
        <button onClick={reset} style={{ padding: "12px 18px", border: "2px solid #151412", background: "#fff", fontWeight: 700 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
