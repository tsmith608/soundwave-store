/**
 * Server-side conversion forwarding (Meta Conversions API, TikTok Events API,
 * GA4 Measurement Protocol). Every function is a no-op unless its credentials
 * are set, and never throws: tracking must not break checkout or webhooks.
 * Secrets are read from server environment variables only.
 */
import crypto from "crypto";

export interface ServerConversion {
  name: "Purchase";
  eventId: string; // shared with the browser pixel for deduplication (we use the order id)
  value: number; // dollars
  currency?: string;
  email?: string | null;
  orderId: string;
  designId?: string;
  clientIp?: string | null;
  userAgent?: string | null;
  url?: string;
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    clearTimeout(t);
  } catch (err) {
    console.warn("[serverEvents] forward failed:", (err as Error).message);
  }
}

export async function forwardConversion(ev: ServerConversion): Promise<void> {
  const tasks: Promise<void>[] = [];
  const now = Math.floor(Date.now() / 1000);

  const metaPixel = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (metaPixel && process.env.META_CAPI_TOKEN) {
    tasks.push(
      post(`https://graph.facebook.com/v21.0/${metaPixel}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN)}`, {
        data: [
          {
            event_name: ev.name,
            event_time: now,
            event_id: ev.eventId,
            action_source: "website",
            event_source_url: ev.url,
            user_data: {
              em: ev.email ? [sha256(ev.email)] : undefined,
              client_ip_address: ev.clientIp ?? undefined,
              client_user_agent: ev.userAgent ?? undefined,
            },
            custom_data: { currency: ev.currency ?? "USD", value: ev.value, order_id: ev.orderId, content_ids: ev.designId ? [ev.designId] : undefined },
          },
        ],
        test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
      })
    );
  }

  const ttPixel = process.env.TIKTOK_PIXEL_ID || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  if (ttPixel && process.env.TIKTOK_EVENTS_TOKEN) {
    tasks.push(
      post(
        "https://business-api.tiktok.com/open_api/v1.3/event/track/",
        {
          event_source: "web",
          event_source_id: ttPixel,
          data: [
            {
              event: "CompletePayment",
              event_time: now,
              event_id: ev.eventId,
              user: { email: ev.email ? sha256(ev.email) : undefined, ip: ev.clientIp ?? undefined, user_agent: ev.userAgent ?? undefined },
              page: ev.url ? { url: ev.url } : undefined,
              properties: { currency: ev.currency ?? "USD", value: ev.value, order_id: ev.orderId, content_type: "product", content_id: ev.designId },
            },
          ],
        },
        { "Access-Token": process.env.TIKTOK_EVENTS_TOKEN }
      )
    );
  }

  const ga = process.env.NEXT_PUBLIC_GA4_ID;
  if (ga && process.env.GA4_API_SECRET) {
    tasks.push(
      post(`https://www.google-analytics.com/mp/collect?measurement_id=${ga}&api_secret=${encodeURIComponent(process.env.GA4_API_SECRET)}`, {
        client_id: ev.orderId,
        events: [{ name: "purchase", params: { transaction_id: ev.orderId, value: ev.value, currency: ev.currency ?? "USD", items: [{ item_id: ev.designId }] } }],
      })
    );
  }

  await Promise.all(tasks);
}
