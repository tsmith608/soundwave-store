# Analytics Plan

**Goal:** know where people drop off before spending anything on ads. Everything below is implemented in code unless marked *owner action*.

---

## 1. Funnel events

| # | Funnel step | Event (ours) | GA4 name | Meta Pixel | TikTok Pixel | Fired from |
|---|---|---|---|---|---|---|
| 1 | Landing-page view | `landing_view` | `landing_view` (+ auto `page_view`) | PageView (auto) | page (auto) | `src/components/Analytics.tsx` on `/`, `/designs` and intent pages |
| 2 | Design selected | `design_selected` | `select_item` | ViewContent | ViewContent | Studio load + every design click (once per design per page view) |
| 3 | Personalisation started | `personalization_started` | custom | custom | — | First keystroke in any field |
| 4 | Audio uploaded | `audio_uploaded` | custom | custom | — | After the file is decoded *and* saved (includes `duration_s`) |
| 5 | Preview generated | `preview_generated` | custom | custom | — | First real-audio preview per design and recording |
| 6 | Add to cart | `add_to_cart` | `add_to_cart` | AddToCart | AddToCart | "Order" button click (value, size, format) |
| 7 | Checkout initiated | `checkout_initiated` | `begin_checkout` | InitiateCheckout | InitiateCheckout | Checkout session created, just before redirect |
| 8 | Purchase | `purchase` | `purchase` | Purchase | CompletePayment | **Browser**: order page after Stripe success. **Server**: Stripe webhook (`forwardConversion`). Same `event_id = purchase_<orderId>` on both. |

**Parameters on every event:** `design_id`, `occasion`, `size`, `format`, `value` (USD), `order_id` where known. We also record `sessionId` (per-tab, sessionStorage), `path` and `referrer`.

**Why a custom event for 3–5?** GA4, Meta and TikTok have no standard events for "started personalising", "uploaded audio" or "saw a real preview", yet these are the steps most likely to leak for us (finding or exporting a recording is the hardest part of the job). GA4 recommends custom events for anything outside its [recommended list](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

## 2. Where the data goes

1. **First-party log (always on).** `POST /api/events` → `AnalyticsEvent` table (Postgres).
   - No cookies and no third parties, so it works before any pixel is set up and it isn't reduced by ad blockers or consent choices.
   - This is the source of truth for the funnel. See the SQL in §5.
2. **GA4** (when `NEXT_PUBLIC_GA4_ID` is set): gtag with **Consent Mode v2** defaults.
   - `analytics_storage` is granted.
   - `ad_storage`, `ad_user_data` and `ad_personalization` are denied until the visitor accepts.
   - Consent Mode v2 has been required for EEA/UK traffic since March 2024. Google's June 2026 change makes `ad_storage` the single control for ad data flowing from GA4 to Ads ([Stape](https://stape.io/blog/google-consent-mode-v2), [ALM Corp](https://almcorp.com/blog/ga4-google-ads-consent-controls-split-june-2026/)).
3. **Meta Pixel** and **TikTok Pixel** (when their public IDs are set) load **only after consent** via the banner. The banner appears only if at least one pixel is configured.
4. **Server-side conversions** (`src/lib/serverEvents.ts`, called from the Stripe webhook):
   - Meta Conversions API: `META_PIXEL_ID` + `META_CAPI_TOKEN`; hashed email; `event_id` for deduplication.
   - TikTok Events API: `TIKTOK_PIXEL_ID` + `TIKTOK_EVENTS_TOKEN`; `event_id` shared with the pixel.
   - GA4 Measurement Protocol: `GA4_API_SECRET`.

   Why: Meta deduplicates browser and server events that share `event_name` + `event_id` within 48 hours ([AdBeacon](https://www.adbeacon.com/conversions-api-deduplication/)). TikTok recommends running Pixel and Events API together with a shared `event_id` ([TikTok](https://ads.tiktok.com/help/article/events-api), [Stape](https://stape.io/helpdesk/documentation/how-to-set-up-tiktok-events-api)). We use a stable id tied to the order, not a per-page-load UUID, because random ids are the most common deduplication failure ([Zenosit](https://www.zenositsolutions.com/insights/meta-capi-event-id-deduplication)).

**Secrets.** Only `NEXT_PUBLIC_*` IDs reach the browser. These are public identifiers by design. Tokens and API secrets are read only in server code.

## 3. Environment variables (owner action)

```
NEXT_PUBLIC_GA4_ID=G-XXXXXXX           # GA4 web stream
GA4_API_SECRET=...                     # GA4 > Admin > Data streams > Measurement Protocol API secrets
NEXT_PUBLIC_META_PIXEL_ID=...          # Meta Events Manager
META_CAPI_TOKEN=...                    # Events Manager > Settings > Conversions API > Generate access token
META_TEST_EVENT_CODE=TEST123           # optional, while testing in Events Manager
NEXT_PUBLIC_TIKTOK_PIXEL_ID=...        # TikTok Events Manager
TIKTOK_EVENTS_TOKEN=...                # TikTok Events Manager > Settings > Events API access token
```

**Recommended order:**
1. GA4 + first-party log now.
2. TikTok Pixel + Events API before the first Spark Ad test.
3. Meta only when Meta tests start (see paid-acquisition-q4-2026.md).

## 4. Validation checklist (owner action, ~30 minutes)

- [ ] Set `NEXT_PUBLIC_GA4_ID`. Open GA4 DebugView, walk the funnel on `/create`, and confirm `select_item` → `personalization_started` → `audio_uploaded` → `preview_generated` → `add_to_cart` → `begin_checkout`.
- [ ] Mark `purchase` as a key event in GA4. Mark `begin_checkout` too, as an early-signal key event for small data.
- [ ] Meta: use Test Events with `META_TEST_EVENT_CODE`. Make a Stripe test-mode purchase and confirm one Purchase shown as "Deduplicated" (browser + server).
- [ ] TikTok: Events Manager → Test events. Confirm CompletePayment is deduplicated.
- [ ] Check the `AnalyticsEvent` table fills (SQL below).

## 5. Reading the funnel without GA4

```sql
-- Sessions reaching each step in the last 14 days
SELECT event, COUNT(DISTINCT "sessionId") AS sessions
FROM "AnalyticsEvent"
WHERE "createdAt" > now() - interval '14 days'
GROUP BY event
ORDER BY CASE event
  WHEN 'landing_view' THEN 1 WHEN 'design_selected' THEN 2 WHEN 'personalization_started' THEN 3
  WHEN 'audio_uploaded' THEN 4 WHEN 'preview_generated' THEN 5 WHEN 'add_to_cart' THEN 6
  WHEN 'checkout_initiated' THEN 7 WHEN 'purchase' THEN 8 END;

-- Which designs get chosen
SELECT params::json->>'design_id' AS design, COUNT(*) FROM "AnalyticsEvent"
WHERE event = 'design_selected' GROUP BY 1 ORDER BY 2 DESC;

-- Where traffic comes from (first landing per session)
SELECT split_part(referrer, '/', 3) AS source, COUNT(DISTINCT "sessionId") FROM "AnalyticsEvent"
WHERE event = 'landing_view' GROUP BY 1 ORDER BY 2 DESC;
```

## 6. UTM discipline

Every link we publish carries UTMs so the first-party log and GA4 agree:

- **Organic TikTok bio:** `?utm_source=tiktok&utm_medium=social&utm_campaign=bio`
- **Per-video links** (Pinterest, IG stories): `utm_content=<concept-id>` (e.g. `c07`) from content-strategy-q4-2026.md.
- **Paid:** `utm_source=tiktok|meta&utm_medium=paid&utm_campaign=<test-name>&utm_content=<creative-id>`

## 7. Decision thresholds

These are hypotheses for the first 1,000 studio sessions:

| Ratio | If below… | Look at |
|---|---|---|
| landing → design_selected | 35% | Hero clarity and imagery |
| design_selected → audio_uploaded | 30% | The recording step: help copy, formats, mobile upload. **Most likely leak.** |
| audio_uploaded → add_to_cart | 25% | Price, size or format clarity; preview trust |
| add_to_cart → purchase | 50% | Checkout friction, shipping-date anxiety, payment errors |

## 8. Not tracked on purpose

- **Recording content, names and messages never go to analytics.** Only the design id, size and format do.
- **No session replay or heatmap tools** by default. Memorial users are grieving, and recording their sessions adds privacy risk for little gain at this scale.
