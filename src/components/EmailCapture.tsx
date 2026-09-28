"use client";

import React, { useState } from "react";

/**
 * Minimal email capture for shipping-cutoff reminders and launch news.
 * Sending is done from the owner's email tool (Resend or similar) — see docs/q4-launch-calendar.md.
 */
export default function EmailCapture({ source, heading, blurb, dark = false }: { source: string; heading: string; blurb: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, source }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setState("done");
    else {
      setState("error");
      setMsg(data.error || "Something went wrong.");
    }
  };
  return (
    <div>
      <div className={`display text-3xl ${dark ? "text-paper" : "text-ink"}`}>{heading}</div>
      <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-[#6B655F]"}`}>{blurb}</p>
      {state === "done" ? (
        <p className="mt-3 text-sm text-[#3F6B45]">Thanks — we&apos;ll be in touch. Unsubscribe any time.</p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex gap-2 max-w-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="flex-1 min-w-0 h-12 border-2 border-current bg-transparent px-3 text-[15px] placeholder:opacity-50 focus:outline-none"
          />
          <button disabled={state === "busy"} className="h-12 border-2 border-current bg-signal px-4 text-sm font-semibold text-ink disabled:opacity-60">
            {state === "busy" ? "…" : "Remind me"}
          </button>
        </form>
      )}
      {state === "error" && <p className="mt-2 text-sm text-[#A3402C]">{msg}</p>}
      <p className={`mt-2 text-xs ${dark ? "text-white/50" : "text-[#9E968F]"}`}>Two or three emails before Christmas, then occasional news. No sharing, ever.</p>
    </div>
  );
}
