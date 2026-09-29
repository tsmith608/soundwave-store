"use client";

import React, { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/actions";

/** One-click admin action with pending + result state. `confirm` asks before running. */
export function ActionButton({ action, label, confirm, tone = "default" }: { action: () => Promise<ActionResult>; label: string; confirm?: string; tone?: "default" | "danger" }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setRes(await action()));
        }}
        className={`min-h-[40px] border-2 px-3 text-sm font-semibold disabled:opacity-50 ${tone === "danger" ? "border-[#B2361B] text-[#7E2512]" : "border-ink"} bg-paper hover:bg-paper-2`}
      >
        {pending ? "Working…" : label}
      </button>
      {res && (
        <span role="status" className={`mt-1 text-xs ${res.ok ? "text-[#2F6B3A]" : "text-[#7E2512]"}`}>
          {res.message}
        </span>
      )}
    </span>
  );
}

/** Form-based admin action (refund/cancel/...) that requires typing the order number. */
export function ConfirmForm({
  action,
  title,
  submitLabel,
  confirmHint,
  children,
  tone = "danger",
}: {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  title: string;
  submitLabel: string;
  confirmHint?: string;
  children?: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={`space-y-2 border-2 p-3 ${tone === "danger" ? "border-[#B2361B]" : "border-ink"}`}>
      <p className="font-semibold">{title}</p>
      {children}
      {confirmHint && (
        <label className="block text-sm">
          {confirmHint}
          <input name="confirm" required autoComplete="off" className="mt-1 h-10 w-full border-2 border-ink px-2 uppercase" />
        </label>
      )}
      <button disabled={pending} className={`min-h-[40px] border-2 px-3 text-sm font-semibold disabled:opacity-50 ${tone === "danger" ? "border-[#B2361B] bg-[#FBE7E1] text-[#7E2512]" : "border-ink bg-paper"}`}>
        {pending ? "Working…" : submitLabel}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-[#2F6B3A]" : "text-[#7E2512]"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
