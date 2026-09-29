/**
 * Client-side funnel tracking.
 *
 * One call fans out to: GA4 (gtag), Meta Pixel (fbq), TikTok Pixel (ttq) when
 * they are loaded, and always to our own /api/events endpoint so the funnel
 * is measurable even before any ad platform is connected. Each event carries
 * an event_id so server-side copies (Conversions API / Events API) can be
 * deduplicated. No secrets live here; see docs/analytics-plan.md.
 */

/**
 * Funnel (docs/analytics-plan.md): page_view → product_view → customizer_started
 * → media_uploaded → design_generated → customization_completed → add_to_cart
 * → checkout_started → purchase (purchase is recorded server-side from the
 * Stripe webhook, never from the browser). Params never contain the
 * customer's words or media — only ids, sizes and amounts.
 */
export type FunnelEvent =
  | "page_view"
  | "product_view"
  | "design_selected"
  | "customizer_started"
  | "media_uploaded"
  | "design_generated"
  | "customization_completed"
  | "add_to_cart"
  | "checkout_started"
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
const GA4_NAME: Record<FunnelEvent, string | null> = {
  page_view: null, // GA4 records page_view itself
  product_view: "view_item",
  design_selected: "select_item",
  customizer_started: "customizer_started",
  media_uploaded: "media_uploaded",
  design_generated: "design_generated",
  customization_completed: "customization_completed",
  add_to_cart: "add_to_cart",
  checkout_started: "begin_checkout",
  purchase: "purchase",
};

const META_NAME: Partial<Record<FunnelEvent, string>> = {
  product_view: "ViewContent",
  add_to_cart: "AddToCart",
  checkout_started: "InitiateCheckout",
  purchase: "Purchase",
};

const TIKTOK_NAME: Partial<Record<FunnelEvent, string>> = {
  product_view: "ViewContent",
  add_to_cart: "AddToCart",
  checkout_started: "InitiateCheckout",
  purchase: "CompletePayment",
};

const ATTR_KEY = "sw_attr";
const ATTR_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ttclid"];

/**
 * First-touch attribution: stored for 30 days on this device and attached to
 * the cart (and so the order). Only marketing parameters and the referrer —
 * nothing personal.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(localStorage.getItem(ATTR_KEY) || "null");
    if (existing && Date.now() - existing.t < 30 * 86400_000) return;
    const q = new URLSearchParams(location.search);
    const data: Record<string, string> = {};
    for (const k of ATTR_PARAMS) {
      const v = q.get(k);
      if (v) data[k] = v.slice(0, 200);
    }
    const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer.slice(0, 300) : "";
    if (ref) data.referrer = ref;
    data.landing = location.pathname.slice(0, 200);
    localStorage.setItem(ATTR_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

export function getAttribution(): Record<string, string> | undefined {
  try {
    return JSON.parse(localStorage.getItem(ATTR_KEY) || "null")?.data;
  } catch {
    return undefined;
  }
}

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
    const g = GA4_NAME[event];
    if (g) window.gtag?.("event", g, { ...params, ...ecommerce, event_id: eventId, transaction_id: params.order_id });
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
