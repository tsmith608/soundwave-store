"use client";

import React, { useState } from "react";

export default function TrackForm() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/orders/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ number, email }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || "We couldn't find that order.");
      window.location.href = d.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  const input = "mt-1 h-12 w-full rounded-xl border border-ink/25 bg-paper px-3 text-[16px]";
  return (
    <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
      <label className="block font-medium">
        Order number
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="SW-10001" required autoComplete="off" className={`${input} uppercase`} />
      </label>
      <label className="block font-medium">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} />
      </label>
      {error && (
        <p role="alert" className="text-[#7E2512]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !number || !email} className="btn btn-ink disabled:opacity-50">
        <span>{busy ? "Looking…" : "Find my order"}</span>
        <span className="btn-arrow" aria-hidden>
          →
        </span>
      </button>
    </form>
  );
}
