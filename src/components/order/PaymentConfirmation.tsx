"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

type State = { phase: "checking" } | { phase: "paid"; number: string; url: string; email: string | null } | { phase: "slow"; number?: string } | { phase: "failed"; number: string } | { phase: "missing" };

/**
 * Waits for the Stripe webhook to confirm payment. The redirect back from
 * Stripe is not proof of payment, so this page only shows "confirmed" once
 * the server has recorded it.
 */
export default function PaymentConfirmation({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State>({ phase: "checking" });

  useEffect(() => {
    if (!sessionId) {
      setState({ phase: "missing" });
      return;
    }
    let stop = false;
    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const r = await fetch(`/api/orders/status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (r.status === 404) {
          setState({ phase: "missing" });
          return;
        }
        const d = await r.json();
        if (d.paid) {
          setState({ phase: "paid", number: d.number, url: d.url, email: d.email });
          try {
            localStorage.removeItem("sw_studio_draft_v2");
          } catch {}
          return;
        }
        if (d.status === "failed") {
          setState({ phase: "failed", number: d.number });
          return;
        }
        if (tries >= 20) {
          setState({ phase: "slow", number: d.number });
          return;
        }
      } catch {
        if (tries >= 20) {
          setState({ phase: "slow" });
          return;
        }
      }
      if (!stop) setTimeout(poll, tries < 5 ? 1500 : 3000);
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  if (state.phase === "checking")
    return (
      <div role="status" aria-live="polite">
        <p className="meta">Checkout</p>
        <h1 className="display mt-3 text-5xl">Confirming your payment…</h1>
        <p className="mt-4 text-lg text-ink-soft">This usually takes a few seconds. Please don&rsquo;t pay again.</p>
        <div className="mt-8 h-2 w-full overflow-hidden border-2 border-ink">
          <div className="anim-playhead h-full w-1/3 bg-signal" />
        </div>
      </div>
    );
  if (state.phase === "paid")
    return (
      <div role="status" aria-live="polite">
        <p className="meta text-[#2F6B3A]">✓ Payment confirmed</p>
        <h1 className="display mt-3 text-6xl">
          Thank you. <span className="accent !font-normal">It&rsquo;s being made.</span>
        </h1>
        <p className="mt-5 text-lg">
          Your order number is <strong>{state.number}</strong>.{state.email ? ` We've emailed a confirmation to ${state.email}.` : ""}
        </p>
        <ol className="mt-8 space-y-3 border-l-4 border-ink pl-5">
          <li>
            <strong>Now:</strong> we prepare your print file from exactly what you previewed.
          </li>
          <li>
            <strong>Next few days:</strong> it&rsquo;s printed{" "}
            and framed to order, then shipped with tracking.
          </li>
          <li>
            <strong>Name or date wrong?</strong> Reply to your confirmation email within 12 hours and we&rsquo;ll fix it before printing.
          </li>
        </ol>
        <div className="mt-10 flex flex-wrap gap-4">
          <a href={state.url} className="btn btn-ink">
            <span>View your order</span>
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </a>
          <Link href="/create" className="meta inline-flex min-h-[44px] items-center underline">
            Make another
          </Link>
        </div>
      </div>
    );
  if (state.phase === "failed")
    return (
      <div role="alert">
        <h1 className="display text-5xl">Your payment didn&rsquo;t go through.</h1>
        <p className="mt-4 text-lg">Nothing was charged for order {state.number}. Your design is saved — you can try again with another payment method.</p>
        <Link href="/cart" className="btn btn-signal mt-8">
          <span>Return to cart</span>
        </Link>
      </div>
    );
  if (state.phase === "slow")
    return (
      <div role="status">
        <h1 className="display text-5xl">Still confirming…</h1>
        <p className="mt-4 text-lg">
          Your payment is taking longer than usual to confirm{state.number ? ` (order ${state.number})` : ""}. You don&rsquo;t need to do anything — we&rsquo;ll email you as soon as it&rsquo;s confirmed. Please don&rsquo;t pay twice.
        </p>
        <p className="mt-4">
          Questions? <Link href="/contact" className="underline">Contact us</Link>.
        </p>
      </div>
    );
  return (
    <div>
      <h1 className="display text-5xl">We couldn&rsquo;t find that checkout.</h1>
      <p className="mt-4 text-lg">
        If you completed a payment, your confirmation email has a link to your order. You can also <Link href="/track" className="underline">track an order</Link> or <Link href="/contact" className="underline">contact us</Link>.
      </p>
    </div>
  );
}
