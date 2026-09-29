# Architecture

## In one paragraph

Each part does one job:
- **Web server (Next.js):** a stateless process that serves the store, the studio, the admin and the API.
- **Worker:** a separate process running the same code. It does all slow or external work: rendering print files, talking to the print lab, sending email, and housekeeping.
- **PostgreSQL:** holds everything durable, including the job queue.
- **Private object-storage bucket:** holds recordings and print files. Browsers upload to it directly through short-lived signed URLs.
- **Stripe:** takes payment. Its webhook is the only thing that can mark an order paid.
- **Prodigi:** prints, frames and ships.
- **Resend:** sends transactional email.
- **Sentry:** collects errors.

```
Browser ──HTTPS──▶ Web (Next.js)  ──────────────▶ PostgreSQL ◀────── Worker (npm run worker)
   │                  │  ▲                            ▲                 │  │  │
   │ signed PUT/GET   │  │ webhooks                   │ jobs (SKIP LOCKED)│  │  └─▶ Resend (email)
   ▼                  │  │                            │                 │  └────▶ Prodigi (orders, status)
Object storage ◀──────┘  └── Stripe, Prodigi, Resend  └─────────────────┘ Chromium renders print files
(private bucket)
```

## Order flow: upload to delivered

1. **Upload.** The studio decodes the file in the browser. Videos stay on the device; only the sound is kept. The browser computes the loudness envelope (the *peaks*). It then:
   - asks `POST /api/uploads` for a signed URL,
   - `PUT`s the audio straight to storage (with a progress bar),
   - calls `POST /api/uploads/:id/complete`.

   The server checks the stored size matches what was declared and **sniffs the magic bytes**, so a disguised file is deleted and rejected. The result is an `UploadedAsset` with status `ready` and a 30-day expiry while unattached.
2. **Customise.** Design, colourway, words, QR option and listen link are autosaved in two places:
   - on the device (so a refresh restores everything),
   - once a recording exists, as a server `Project` owned by the visitor's device cookie or their account.

   Undo and reset are available.
3. **Add to cart.** `POST /api/cart/items` checks the project belongs to the caller and is complete (recording, required words, rights confirmation). The variant comes from the database. The cart is identified by a random cookie, and only its hash is stored.
4. **Checkout.** `POST /api/checkout`:
   - re-validates every item and **re-prices from the database** (the client's numbers are never used);
   - applies the discount rules;
   - in one transaction, creates an `Order` in `pending_payment`, with immutable `OrderItem.artworkSpec` snapshots (exact words, peaks, colourway, QR URL, template version) and a sequential number (`SW-10001`);
   - creates a Stripe Checkout Session for those exact amounts, with a per-order idempotency key and an optional one-time coupon for discounts. Stripe Tax is optional, and tax and shipping are computed by Stripe.

   A double click within 2 minutes reuses the same session.
5. **Payment.** Stripe calls `/api/webhooks/stripe`:
   - the signature is verified by the Stripe SDK;
   - the event is stored once per `(provider, eventId)`;
   - duplicate events are acknowledged without side effects.

   `checkout.session.completed` (when paid) runs one transaction that:
   - moves the order to `paid`, snapshotting address, email and Stripe's final totals including tax;
   - records the `Payment`;
   - redeems the discount once;
   - converts the cart and marks projects `ordered`;
   - takes the recording off the unattached-expiry clock;
   - **enqueues `render_order` and the confirmation email in the same transaction** (transactional outbox), so work can't be lost.

   The browser's success page only *polls* for this; it never confirms anything itself. A maintenance task asks Stripe about any order still pending after 45 minutes, in case a webhook was missed.
6. **Print files** (worker `render_order`):
   - renders each item from its frozen spec with the same engine as the preview (fonts embedded, deterministic);
   - produces a **vector PDF master** at exact trim size and a **300-DPI PNG** for the lab, with optional per-variant bleed, plus a small preview;
   - uploads them to `renders/…` with SHA-256 and renderer version recorded;
   - moves the order `paid → processing_artwork → ready_for_fulfillment`.

   If the design's template version changed since purchase, it stops and flags the order rather than print something different.
7. **Fulfillment** (worker `submit_fulfillment`):
   - one `Fulfillment` row per order, with a unique idempotency key that is also sent to Prodigi, so retries can never create a second print order;
   - the lab downloads the print PNG through a 7-day signed URL;
   - on success: `submitted_to_fulfillment`, and a 30-minute safety-net sync is scheduled;
   - on failure: the paid order stays safe, the error is recorded, the order is flagged `fulfillment_failed`, and it shows in `/admin/fulfillment` with a Retry button.
8. **Production and shipping.** Prodigi calls `/api/webhooks/prodigi?token=…` (a secret token, because Prodigi doesn't sign callbacks). We treat each callback as a hint and **re-fetch the order from Prodigi's API**, then apply the state idempotently. Status only moves forward, so late or out-of-order callbacks are harmless.
   - `in_production`: "being made" email.
   - A new shipment: a `Shipment` row with carrier and tracking, then `shipped` and a tracking email (once per shipment).
   - Delivery reported: `delivered` and an email.
   - A 6-hourly sync covers lost callbacks.
9. **After delivery.** The customer's order page shows progress and tracking. It's reached via a signed link in every email, their account, or the number+email lookup at `/track`. Recordings follow the retention policy: kept while a QR code needs them, otherwise deleted 90 days after delivery.

## Order states

`pending_payment → paid → processing_artwork → ready_for_fulfillment → submitted_to_fulfillment → in_production → shipped → delivered`

Other states are `cancelled`, `refunded` and `failed` (payment failed). The allowed moves are in `src/lib/server/orders/state.ts`. Every change goes through `transition()`, a compare-and-set on the current status that writes an `OrderEvent` (audit trail with actor and message).
- A partial refund doesn't change the status. It updates `refundedCents` and the Payment status, so production progress stays visible.
- A full refund moves the order to `refunded`.
- A late successful payment for a cancelled checkout becomes `paid` and is flagged for review.
- Problems that need a person set `Order.attentionReason`, shown on the admin dashboard: fulfillment failed, lab issue, dispute, template mismatch, paid after cancel.

## Data model (PostgreSQL, `prisma/schema.prisma`)

Money is always integer cents plus currency. There are 30 tables, 15 enums, 23 foreign keys and 65 indexes/unique constraints. The migration is `prisma/migrations/20260929000000_init`.

| Area | Tables (key fields) |
|---|---|
| Identity | `User` (email unique, emailVerifiedAt, role customer/admin, deletedAt) · `Session` (tokenHash unique, expiresAt) · `LoginToken` (tokenHash unique, single use) · `Address` |
| Catalogue | `Product` · `ProductVariant` (format × size unique, priceCents, frameFinishes[], fulfillmentSku, fulfillmentAttributes, bleedIn, printDpi, lead times, active) · `DesignTemplate` (id = design, version, active) |
| Customisation | `Project` (user or hashed device owner, design, colourway, fields, options, peaks, audioAssetId, rightsConfirmedAt, status draft/ordered) · `UploadedAsset` (storageKey unique, mime, size, duration, status pending/ready/rejected/deleted, expiresAt, deleteReason) · `GeneratedAsset` (orderItem, kind print_pdf/print_png/preview_png, sha256, dims, dpi, rendererVersion) |
| Cart | `Cart` (tokenHash unique, status, email, recoveryConsent, discountCode, attribution, convertedOrderId unique) · `CartItem` (project, variant, frameFinish, quantity) |
| Orders | `Order` (number unique, status, money breakdown, refundedCents, ship-to snapshot, Stripe session/PI unique, pricingSnapshot, attribution, attentionReason, paidAt) · `OrderItem` (variant, SKU, price, **artworkSpec snapshot**, templateVersion, audioAssetId, listenToken unique, recordingRemovedAt) · `OrderEvent` (from/to status, actor, message) |
| Money | `Payment` (providerPaymentId unique, status) · `Refund` (idempotencyKey unique, providerRefundId unique, status, createdBy) · `Discount` (code unique, type, value, min spend, variants, dates, limits, timesRedeemed) · `DiscountRedemption` (orderId unique) |
| Fulfillment | `Fulfillment` (idempotencyKey unique, providerOrderId unique, status, providerStatus, cost, attempts, lastError) · `Shipment` (fulfillment + providerShipmentId unique, carrier, tracking, shipped/delivered) |
| Messaging | `EmailMessage` (dedupeKey unique, providerMessageId unique, status) · `ContactMessage` · `Subscriber` |
| Infrastructure | `WebhookEvent` (provider + eventId unique, status, attempts, payload) · `Job` (type, payload, status, dedupeKey unique, runAt, attempts, lastError, lock) · `RateLimit` (key + window) · `AuditEvent` (admin actions) · `AnalyticsEvent` · `Counter` (order numbers) |

Cascades:
- Deleting an order removes its items, events, payments, refunds, fulfillments, shipments and generated assets.
- Deleting a user nulls the link on orders, carts and projects (orders are kept for accounting).
- Customer media bytes never enter the database.

## Idempotency: what stops duplicates

| Side effect | Guard |
|---|---|
| Duplicate orders from double clicks | 2-minute same-cart reuse. An older pending checkout for the cart is cancelled and its Stripe session expired. |
| Duplicate charges | Stripe session idempotency key per order. One Payment per PaymentIntent (unique). |
| Duplicate webhook processing | `WebhookEvent (provider, eventId)` unique. Handlers are compare-and-set transitions. |
| Duplicate print orders | `Fulfillment.idempotencyKey` (unique, and sent to Prodigi). Skip if `providerOrderId` exists. |
| Duplicate refunds | `Refund.idempotencyKey` = `refund:<order>:<n>` (unique, and sent to Stripe). Amount capped at the remaining balance. |
| Duplicate emails | `EmailMessage.dedupeKey` unique (sent as Resend `Idempotency-Key`). |
| Duplicate jobs | `Job.dedupeKey` unique while active. Workers claim with `FOR UPDATE SKIP LOCKED`. |
| Double discount redemption | `DiscountRedemption.orderId` unique. |

## Security

- **Authorization.** Every customer resource is checked against the caller (signed-in user or hashed device key):
  - projects, uploads, cart items;
  - orders, which need a signed link, the owning account, or an admin.
- **Admin.** Allow-listed emails only, via passwordless sign-in. It's checked in the admin layout **and** in every server action, and every action is audited. Refund, cancel and takedown require typing the order number.
- **Sessions.** Random 256-bit tokens, stored as hashes. Cookies are HttpOnly and SameSite=Lax (Secure in production). Tokens rotate at sign-in. Sign-in links are single-use, expire in 20 minutes, and are consumed by POST so email scanners can't burn them.
- **CSRF.** State-changing JSON endpoints check `Origin`. Server Actions have Next's built-in origin check.
- **Input.** zod validation on every endpoint. Payload size limits. Parameterised queries (Prisma).
  - React escapes all output. JSON-LD escapes `<`. Email templates escape everything.
  - Listen links are http(s) only and never fetched. Post-login redirects are same-site relative only.
- **Uploads.** An audio MIME allow-list, 12 MB and 3-minute caps, content sniffing after upload, and random object keys. The bucket is private, and reads are 5–10 minute signed URLs.
- **Webhooks.**
  - Stripe: SDK signature with a 5-minute tolerance.
  - Resend: Svix signature.
  - Prodigi: a secret URL token, with state re-fetched from the API.
- **Headers** (`src/proxy.ts`):
  - CSP, with `frame-ancestors 'none'` and `object-src 'none'`; storage and analytics origins are allow-listed;
  - HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`;
  - `noindex` and `no-store` on private pages.
- **Rate limits** (Postgres, work across instances): uploads, projects, cart, discount guessing, checkout, sign-in, contact, order lookup, analytics.
- **Secrets.** Only `NEXT_PUBLIC_*` values reach the browser. The environment is validated at boot, and a misconfigured production refuses to start. Logs redact keys that look like secrets, URLs or addresses.

## Scaling notes

- **Web processes are stateless:** scale horizontally. Workers can also run in parallel (SKIP LOCKED).
- **Queries:** lists are paginated, and the status, date, email and attention fields are indexed.
- **Large data:** binary data lives in object storage. Peaks are at most 2,000 floats per item.
- **Heavy work:** Chromium rendering only runs in the worker. Give the worker about 2 GB of RAM, and raise `WORKER_CONCURRENCY` only with more memory.
- **Growth path:** the Postgres queue is fine for thousands of orders a day. The boundary (`enqueue`/`claimJobs`) is the only thing to swap for a managed queue.
