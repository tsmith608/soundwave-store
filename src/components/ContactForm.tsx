"use client";

import React, { useState } from "react";

const TOPICS = ["An order", "A recording or design question", "Remove my recording", "Wholesale / press", "Something else"];

export default function ContactForm({ defaultOrder, defaultTopic }: { defaultOrder: string; defaultTopic?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "We couldn't send that. Please email us instead.");
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };
  if (state === "sent")
    return (
      <p role="status" className="h-fit border-2 border-ink bg-botanical p-6 text-lg">
        Thanks — your message is with us. We&rsquo;ve emailed you a copy and will reply soon.
      </p>
    );
  const input = "mt-1 h-12 w-full border-2 border-ink bg-paper px-3 text-[16px]";
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block font-medium">
        Your name
        <input name="name" required autoComplete="name" className={input} />
      </label>
      <label className="block font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="block font-medium">
        What&rsquo;s it about?
        <select name="topic" defaultValue={defaultTopic ?? TOPICS[0]} className={input}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="block font-medium">
        Order number <span className="font-normal text-ink-soft">(if you have one)</span>
        <input name="orderNumber" defaultValue={defaultOrder} className={`${input} uppercase`} />
      </label>
      <label className="block font-medium">
        Message
        <textarea name="message" required rows={6} className="mt-1 w-full border-2 border-ink bg-paper p-3 text-[16px]" />
      </label>
      <div aria-hidden className="absolute left-[-9999px]">
        <label>
          Leave this empty <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-[#7E2512]">
          {error}
        </p>
      )}
      <button disabled={state === "sending"} className="btn btn-signal disabled:opacity-50">
        <span>{state === "sending" ? "Sending…" : "Send message"}</span>
        <span className="btn-arrow" aria-hidden>
          →
        </span>
      </button>
    </form>
  );
}
