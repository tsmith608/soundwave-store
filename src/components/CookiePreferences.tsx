"use client";

import React, { useEffect, useState } from "react";

export default function CookiePreferences() {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    try {
      setV(localStorage.getItem("sw_consent"));
    } catch {}
  }, []);
  const set = (next: "granted" | "denied") => {
    try {
      localStorage.setItem("sw_consent", next);
    } catch {}
    setV(next);
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.("consent", "update", { ad_storage: next, ad_user_data: next, ad_personalization: next });
    window.dispatchEvent(new Event("sw:consent"));
  };
  return (
    <div className="mt-4 border-2 border-ink p-4" aria-live="polite">
      <p>
        Advertising cookies are currently: <strong>{v === "granted" ? "allowed" : v === "denied" ? "declined" : "not chosen (off)"}</strong>
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => set("granted")} className="btn !min-h-[44px]">
          <span>Allow advertising cookies</span>
        </button>
        <button type="button" onClick={() => set("denied")} className="btn btn-ink !min-h-[44px]">
          <span>Decline</span>
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-soft">If you decline after allowing, clear this site&rsquo;s data in your browser to remove cookies already set.</p>
    </div>
  );
}
