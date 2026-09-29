"use client";

import Link from "next/link";
import React, { useState } from "react";
import Artwork from "@/components/art/Artwork";
import type { ArtFields } from "@/lib/art";
import { formatCents, type Quote } from "@/lib/commerce";
import { FRAME_FINISHES, getPrintSize } from "@/lib/catalog";
import { getAttribution, track } from "@/lib/analytics";

export interface CartItemDto {
  id: string;
  projectId: string;
  designId: string;
  designName: string;
  colorwayId: string;
  fields: unknown;
  options: unknown;
  peaks: unknown;
  variant: { id: string; label: string; sizeId: string; format: "print" | "framed"; priceCents: number; frameFinishes: string[]; leadTimeMinDays: number; leadTimeMaxDays: number };
  frameFinish: string | null;
  quantity: number;
  lineTotalCents: number;
  problems: string[];
}

export interface CartDto {
  id: string | null;
  email: string | null;
  recoveryConsent: boolean;
  discountCode: string | null;
  items: CartItemDto[];
  quote: Quote | null;
}

async function call(url: string, method: string, body?: unknown): Promise<{ cart?: CartDto | null; error?: string; checkoutUrl?: string; orderNumber?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Something went wrong. Please try again." };
    return data;
  } catch {
    return { error: "You seem to be offline. Check your connection and try again." };
  }
}

export default function CartView({ initial, notice }: { initial: CartDto | null; notice: "cancelled" | "added" | null }) {
  const [cart, setCart] = useState<CartDto | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [consent, setConsent] = useState(initial?.recoveryConsent ?? false);

  const update = async (key: string, url: string, method: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    const r = await call(url, method, body);
    if (r.error) setError(r.error);
    else if ("cart" in r) setCart(r.cart ?? null);
    setBusy(null);
    return r;
  };

  const applyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setBusy("code");
    const r = await call("/api/cart/discount", "POST", { code });
    setBusy(null);
    if (r.error) setCodeError(r.error);
    else {
      setCart(r.cart ?? null);
      setCode("");
    }
  };

  const checkout = async () => {
    setError(null);
    setBusy("checkout");
    const attribution = getAttribution();
    if (email || attribution) await call("/api/cart", "PATCH", { email: email || null, recoveryConsent: consent, attribution });
    track("checkout_started", { value: (cart?.quote?.totalCents ?? 0) / 100, currency: "USD", items: cart?.items.length ?? 0 });
    const r = await call("/api/checkout", "POST", { email: email || null });
    if (r.error || !r.checkoutUrl) {
      setError(r.error ?? "We couldn't start checkout. Please try again.");
      setBusy(null);
      return;
    }
    window.location.href = r.checkoutUrl;
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mt-10 border-2 border-ink bg-paper-2 p-8 sm:p-12">
        {notice === "cancelled" && <p className="mb-4 text-ink-soft">Checkout was cancelled.</p>}
        <p className="display text-4xl">Nothing here yet.</p>
        <p className="mt-3 max-w-lg text-lg text-ink-soft">Start with a voice memo, a saved voicemail or a video from your camera roll — we&rsquo;ll show you exactly what we&rsquo;ll print.</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/create" className="btn btn-signal">
            <span>Create your piece</span>
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href="/account" className="meta inline-flex min-h-[44px] items-center underline">
            Saved designs
          </Link>
        </div>
      </div>
    );
  }

  const q = cart.quote!;
  const hasProblems = cart.items.some((i) => i.problems.length);
  const lead = { min: Math.max(...cart.items.map((i) => i.variant.leadTimeMinDays)), max: Math.max(...cart.items.map((i) => i.variant.leadTimeMaxDays)) };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-label="Items">
        {notice === "cancelled" && (
          <p role="status" className="mb-4 border-2 border-ink bg-film p-3">
            Checkout was cancelled — nothing was charged and your cart is saved.
          </p>
        )}
        {notice === "added" && (
          <p role="status" className="mb-4 border-2 border-ink bg-botanical p-3">
            ✓ Added to your cart.
          </p>
        )}
        <ul className="divide-y-2 divide-ink border-y-2 border-ink">
          {cart.items.map((it) => {
            const f = it.fields as ArtFields;
            const o = (it.options ?? {}) as { showQr?: boolean; qrStyle?: "discreet" | "standard" };
            const size = getPrintSize(it.variant.sizeId);
            return (
              <li key={it.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:gap-6">
                <div className="border-2 border-ink bg-paper-2 p-2">
                  <Artwork designId={it.designId} fields={f} peaks={(it.peaks as number[]) ?? null} colorwayId={it.colorwayId} widthIn={size?.widthIn} heightIn={size?.heightIn} showQr={o.showQr !== false} qrStyle={o.qrStyle ?? "discreet"} idPrefix={`cart-${it.id}`} />
                </div>
                <div className="min-w-0">
                  <p className="display text-2xl">{it.designName}</p>
                  <p className="text-ink-soft">
                    {it.variant.label}
                    {it.frameFinish ? ` · ${FRAME_FINISHES.find((x) => x.id === it.frameFinish)?.label ?? it.frameFinish} frame` : ""}
                  </p>
                  <p className="mt-1 truncate text-sm">{[f.title, f.names, f.date].filter(Boolean).join(" · ")}</p>
                  {it.problems.length > 0 && (
                    <p role="alert" className="mt-2 text-sm text-[#7E2512]">
                      {it.problems.join(" ")}{" "}
                      <Link href={`/create?item=${it.id}`} className="font-semibold underline">
                        Fix it
                      </Link>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      Qty
                      <select
                        value={it.quantity}
                        disabled={busy !== null}
                        onChange={(e) => update(it.id, `/api/cart/items/${it.id}`, "PATCH", { quantity: Number(e.target.value) })}
                        className="h-11 border-2 border-ink bg-paper px-2"
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Link href={`/create?item=${it.id}`} className="meta inline-flex min-h-[44px] items-center underline">
                      Edit design
                    </Link>
                    <button type="button" disabled={busy !== null} onClick={() => update(it.id, `/api/cart/items/${it.id}`, "DELETE")} className="meta min-h-[44px] underline">
                      {busy === it.id ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
                <p className="col-start-2 text-lg font-semibold sm:col-start-3 sm:text-right">{formatCents(it.lineTotalCents)}</p>
              </li>
            );
          })}
        </ul>
        <Link href="/create" className="meta mt-4 inline-flex min-h-[44px] items-center underline">
          + Add another piece
        </Link>
      </section>

      <aside aria-label="Order summary" className="h-fit border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_#151412] lg:sticky lg:top-24">
        <h2 className="display text-3xl">Summary</h2>
        <dl className="mt-4 space-y-2 text-[15px]">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatCents(q.subtotalCents)}</dd>
          </div>
          {q.discount && (
            <div className="flex justify-between text-[#2F6B3A]">
              <dt>
                {q.discount.code} · {q.discount.label}{" "}
                <button type="button" onClick={() => update("code", "/api/cart/discount", "DELETE")} className="ml-1 underline" aria-label={`Remove code ${q.discount.code}`}>
                  remove
                </button>
              </dt>
              <dd>{q.discountCents ? `−${formatCents(q.discountCents)}` : ""}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{q.shippingCents === 0 ? "Free" : formatCents(q.shippingCents)}</dd>
          </div>
          <div className="flex justify-between text-ink-soft">
            <dt>Tax</dt>
            <dd>Calculated at checkout</dd>
          </div>
          <div className="flex justify-between border-t-2 border-ink pt-2 text-lg font-semibold">
            <dt>Estimated total</dt>
            <dd>{formatCents(q.totalCents)}</dd>
          </div>
        </dl>
        {q.discountMessage && <p className="mt-2 text-sm text-[#7E2512]">{q.discountMessage}</p>}

        {!q.discount && (
          <form onSubmit={applyCode} className="mt-4 flex gap-2">
            <label className="sr-only" htmlFor="code">
              Discount code
            </label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" autoComplete="off" className="h-11 min-w-0 flex-1 border-2 border-ink bg-paper px-3 uppercase" aria-invalid={Boolean(codeError)} aria-describedby={codeError ? "code-error" : undefined} />
            <button type="submit" disabled={!code.trim() || busy !== null} className="btn !min-h-[44px] !text-sm disabled:opacity-40">
              <span>{busy === "code" ? "…" : "Apply"}</span>
            </button>
          </form>
        )}
        {codeError && (
          <p id="code-error" role="alert" className="mt-1 text-sm text-[#7E2512]">
            {codeError}
          </p>
        )}

        <label className="mt-5 block text-[15px]">
          <span className="font-medium">Email for your receipt</span> <span className="text-ink-soft">(or enter it at checkout)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" className="mt-1 h-11 w-full border-2 border-ink bg-paper px-3" />
        </label>
        {email && (
          <label className="mt-2 flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#151412]" />
            <span>If I don&rsquo;t finish, it&rsquo;s OK to send me one reminder about this cart.</span>
          </label>
        )}

        {error && (
          <p role="alert" className="mt-4 border-2 border-[#B2361B] bg-[#FBE7E1] p-3 text-sm text-[#7E2512]">
            {error}
          </p>
        )}
        <button type="button" onClick={checkout} disabled={busy !== null || hasProblems} className="btn btn-signal mt-5 w-full justify-between disabled:opacity-50">
          <span>{busy === "checkout" ? "Opening secure checkout…" : "Checkout"}</span>
          <span className="btn-arrow" aria-hidden>
            →
          </span>
        </button>
        {hasProblems && <p className="mt-2 text-sm text-[#7E2512]">Please fix the items marked above first.</p>}
        <ul className="mt-5 space-y-1.5 text-sm text-ink-soft">
          <li>🔒 Secure checkout by Stripe — card, Apple Pay, Google Pay. We never see your card number.</li>
          <li>Made to order; usually {lead.min}–{lead.max} business days to your door (US).</li>
          <li>
            Damaged or not as previewed? We reprint it free. <Link href="/returns" className="underline">Returns</Link> · <Link href="/shipping" className="underline">Shipping</Link>
          </li>
        </ul>
      </aside>
    </div>
  );
}
