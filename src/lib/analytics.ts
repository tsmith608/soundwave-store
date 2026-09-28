/**
 * Client-side funnel tracking.
 *
 * One call fans out to: GA4 (gtag), Meta Pixel (fbq), TikTok Pixel (ttq) when
 * they are loaded, and always to our own /api/events endpoint so the funnel
 * is measurable even before any ad platform is connected. Each event carries
 * an event_id so server-side copies (Conversions API / Events API) can be
 * deduplicated. No secrets live here; see docs/analytics-plan.md.
 */

export type FunnelEvent =
  | "landing_view"
  | "design_selected"
  | "personalization_started"
  | "audio_uploaded"
  | "preview_generated"
  | "add_to_cart"
  | "checkout_initiated"
  | "purchase";

export interface EventParams {
  design_id?: string;
  occasion?: string;
  size?: string;
  format?: string;
  value?: number; // dollars
  currency?: string;
  order_id?: string;
  page?: string;
  source?: string;
  [key: string]: string | number | boolean | undefined;
}

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (name: string, params?: Record<string, unknown>, opts?: Record<string, unknown>) => void };

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    ttq?: Ttq;
    dataLayer?: unknown[];
  }
}

/** GA4 recommended event names where one exists. */
const GA4_NAME: Record<FunnelEvent, string> = {
  landing_view: "landing_view",
  design_selected: "select_item",
  personalization_started: "personalization_started",
  audio_uploaded: "audio_uploaded",
  preview_generated: "preview_generated",
  add_to_cart: "add_to_cart",
  checkout_initiated: "begin_checkout",
  purchase: "purchase",
};

const META_NAME: Partial<Record<FunnelEvent, string>> = {
  design_selected: "ViewContent",
  add_to_cart: "AddToCart",
  checkout_initiated: "InitiateCheckout",
  purchase: "Purchase",
};

const TIKTOK_NAME: Partial<Record<FunnelEvent, string>> = {
  design_selected: "ViewContent",
  add_to_cart: "AddToCart",
  checkout_initiated: "InitiateCheckout",
  purchase: "CompletePayment",
};

const once = new Set<string>();

export function newEventId(prefix = "ev"): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

function sessionId(): string {
  try {
    const k = "sw_sid";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = newEventId("s");
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "nosession";
  }
}

/**
 * Track a funnel event. `onceKey` suppresses repeats within a page view
 * (e.g. preview_generated should count once per design, not per keystroke).
 */
export function track(event: FunnelEvent, params: EventParams = {}, opts: { eventId?: string; onceKey?: string } = {}): string {
  if (typeof window === "undefined") return "";
  if (opts.onceKey) {
    const key = `${event}:${opts.onceKey}`;
    if (once.has(key)) return "";
    once.add(key);
  }
  const eventId = opts.eventId ?? newEventId();
  const ecommerce =
    params.value !== undefined
      ? {
          currency: params.currency ?? "USD",
          value: params.value,
          items: params.design_id ? [{ item_id: params.design_id, item_name: params.design_id, item_variant: [params.size, params.format].filter(Boolean).join(" ") }] : undefined,
        }
      : {};

  try {
    window.gtag?.("event", GA4_NAME[event], { ...params, ...ecommerce, event_id: eventId, transaction_id: params.order_id });
  } catch {}
  try {
    const m = META_NAME[event];
    if (m) window.fbq?.("track", m, { value: params.value, currency: params.currency ?? "USD", content_ids: params.design_id ? [params.design_id] : undefined, content_type: "product" }, { eventID: eventId });
    else window.fbq?.("trackCustom", event, params, { eventID: eventId });
  } catch {}
  try {
    const t = TIKTOK_NAME[event];
    if (t) window.ttq?.track(t, { value: params.value, currency: params.currency ?? "USD", content_id: params.design_id, content_type: "product" }, { event_id: eventId });
  } catch {}

  try {
    const body = JSON.stringify({ event, eventId, sessionId: sessionId(), path: location.pathname, referrer: document.referrer || undefined, params });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {}
  return eventId;
}
