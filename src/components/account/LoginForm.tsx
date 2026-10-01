"use client";

import React, { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Please try again.");
      setState("sent");
    } catch (err) {
      setMsg((err as Error).message);
      setState("error");
    }
  };
  if (state === "sent")
    return (
      <p role="status" className="mt-8 rounded-xl border border-ink/15 bg-botanical p-4 text-lg">
        Check your inbox for a sign-in link from us. It works once and expires in 20 minutes.
      </p>
    );
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block font-medium">
        Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 h-12 w-full rounded-xl border border-ink/25 bg-paper px-3 text-[16px]" />
      </label>
      {state === "error" && (
        <p role="alert" className="text-[#7E2512]">
          {msg}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="btn btn-ink disabled:opacity-50">
        <span>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</span>
      </button>
    </form>
  );
}
