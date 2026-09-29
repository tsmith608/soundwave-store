"use client";

import React, { useState } from "react";

async function post(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
}

export function ReorderButton({ orderItemId }: { orderItemId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const d = await post("/api/account/reorder", "POST", { orderItemId });
            window.location.href = d.cartUrl;
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
        className="meta min-h-[44px] underline"
      >
        {busy ? "Adding…" : "Order again"}
      </button>
      {err && <span className="block text-xs text-[#7E2512]">{err}</span>}
    </span>
  );
}

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return <p className="text-xs text-ink-soft">Deleted.</p>;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!window.confirm("Delete this design and its recording? This can't be undone.")) return;
        try {
          await post(`/api/projects/${projectId}`, "DELETE");
          setGone(true);
        } catch (e) {
          alert((e as Error).message);
        }
      }}
      className="meta min-h-[44px] underline"
    >
      Delete
    </button>
  );
}

export function AddressBook({ initial }: { initial: { id: string; text: string; isDefault: boolean }[] }) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = "h-11 w-full border-2 border-ink bg-paper px-3";
  return (
    <div className="mt-4">
      {list.length === 0 && <p className="text-ink-soft">No saved addresses. You&rsquo;ll enter your shipping address at checkout.</p>}
      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 border-2 border-ink p-3">
            <span>
              {a.text}
              {a.isDefault && <span className="meta ml-2">default</span>}
            </span>
            <button
              type="button"
              className="meta min-h-[44px] underline"
              onClick={async () => {
                await post(`/api/account/addresses?id=${a.id}`, "DELETE");
                setList((l) => l.filter((x) => x.id !== a.id));
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            const f = new FormData(e.currentTarget);
            const body = Object.fromEntries(f.entries()) as Record<string, string>;
            try {
              const d = await post("/api/account/addresses", "POST", { ...body, isDefault: body.isDefault === "on" });
              const a = d.address;
              setList((l) => [...l, { id: a.id, text: [a.name, a.line1, a.city, a.postalCode].join(" · "), isDefault: a.isDefault }]);
              setOpen(false);
            } catch (e2) {
              setErr((e2 as Error).message);
            }
          }}
        >
          <label className="sm:col-span-2">
            Full name <input name="name" required autoComplete="name" className={input} />
          </label>
          <label className="sm:col-span-2">
            Address <input name="line1" required autoComplete="address-line1" className={input} />
          </label>
          <label className="sm:col-span-2">
            Apartment, suite (optional) <input name="line2" autoComplete="address-line2" className={input} />
          </label>
          <label>
            City <input name="city" required autoComplete="address-level2" className={input} />
          </label>
          <label>
            State <input name="state" autoComplete="address-level1" className={input} />
          </label>
          <label>
            ZIP <input name="postalCode" required autoComplete="postal-code" className={input} />
          </label>
          <label>
            Country <input name="country" defaultValue="US" maxLength={2} required autoComplete="country" className={`${input} uppercase`} />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="isDefault" className="h-5 w-5" /> Default address
          </label>
          {err && (
            <p role="alert" className="text-[#7E2512] sm:col-span-2">
              {err}
            </p>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <button className="btn btn-ink">
              <span>Save address</span>
            </button>
            <button type="button" onClick={() => setOpen(false)} className="meta underline">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="meta mt-3 min-h-[44px] underline">
          + Add an address
        </button>
      )}
    </div>
  );
}

export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-4 space-y-6">
      <form method="post" action="/api/auth/logout">
        <button className="btn">
          <span>Sign out</span>
        </button>
      </form>
      <div className="max-w-xl border-2 border-[#B2361B] p-4">
        <p className="font-semibold">Delete my account</p>
        <p className="mt-1 text-sm text-ink-soft">
          Removes your sign-in, saved designs and addresses, and deletes recordings not used by an order. Paid orders are kept for our accounting records. To also remove recordings behind printed codes, contact us.
        </p>
        {confirming ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm">
              Type DELETE to confirm{" "}
              <input value={text} onChange={(e) => setText(e.target.value)} className="h-11 border-2 border-ink px-2" />
            </label>
            <button
              type="button"
              disabled={text !== "DELETE"}
              onClick={async () => {
                try {
                  await post("/api/account/delete", "POST", { confirm: "DELETE" });
                  window.location.href = "/";
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
              className="btn !border-[#B2361B] disabled:opacity-40"
            >
              <span>Delete account</span>
            </button>
            {err && <span className="text-sm text-[#7E2512]">{err}</span>}
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="meta mt-3 min-h-[44px] underline">
            Delete my account…
          </button>
        )}
      </div>
    </div>
  );
}
