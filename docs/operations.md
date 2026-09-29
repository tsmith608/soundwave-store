# Operations runbook

Everything below is done in `/admin` unless noted. Every admin action is written to the audit log (`/admin/system`).

## Daily (5 minutes)

1. **Dashboard → Needs attention.** Each row names its reason:
   - `fulfillment_failed`: open the order, read the error in *Fulfillment*, fix the cause (usually a SKU or address), then **Retry print / fulfillment**.
   - `fulfillment_issue`: the lab reported a problem (e.g. it couldn't download the file). Check the message, then **Sync with lab now** or retry.
   - `fulfillment_cancelled`: the lab cancelled. Decide whether to resubmit (retry) or refund.
   - `dispute`: a chargeback. Respond in the Stripe dashboard (Payments → Disputes) with the order's details and tracking.
   - `paid_after_cancel`: payment arrived after the checkout had been replaced. The order will print normally; check the customer didn't also pay for the newer checkout. Refund the duplicate if they did.
   - `template_version_mismatch`: a design changed between payment and rendering. Render from the matching code version before printing.
2. **Dashboard → Dead jobs / Failed webhooks / Email failures.** Retry from `/admin/system` once the cause is fixed.
3. **Support.** Reply to open messages from your email client, then mark them answered.

## Common tasks

| Task | How |
|---|---|
| Refund (full or partial) | Order → *Refund* → amount + reason → type the order number. Stripe refunds use an idempotency key, so a double click can't refund twice. The customer is emailed automatically. |
| Cancel | Order → *Cancel order* (optionally refund in full). Works until the lab starts production; after that, use a refund. |
| Customer typo | Paid orders wait `FULFILLMENT_HOLD_HOURS` (default 12) before going to the lab — the confirmation email invites corrections in that window. Order → item → **Correct the text** → save: new print files are rendered and the corrected version is what the lab receives (old files kept, change audited). Once submitted to the lab, it can't be edited: cancel/refund or reprint. |
| Reprint (damage / misprint) | Create a free replacement: ask the customer to reorder with a 100%-off single-use code (Discounts → type Percent, value 100, max uses 1), or place it directly in the Prodigi dashboard using the order's *print_png* download. |
| Remove a recording (takedown / privacy request) | Order → *Remove recording*, or `npm run uploads:remove -- SW-10001 --apply`. The QR page then says it was removed. |
| Delete a customer's data | They can delete their account from `/account`. For guests: remove recordings as above; order records are kept for accounting. |
| Change a price / SKU / lead time | Products. Takes effect immediately for new carts and checkouts. |
| Hide a design | Designs → Hide. |
| Discount codes | Discounts: percent, fixed, or free shipping; dates, minimum spend, total and per-customer limits, specific products. |
| Send an order to the lab now (skip the hold) | Order → **Retry print / fulfillment**. |
| Pause automatic lab submission | Set `FULFILLMENT_AUTO_SUBMIT=false` and redeploy. Paid orders then wait at "ready" until you press *Retry print / fulfillment* (useful for manual proofing in the first weeks). |

## Pre-launch rehearsal (test mode)

With Stripe **test** keys and the Prodigi **sandbox**:

1. Order one of each variant with test card `4242 4242 4242 4242`. Check the confirmation email and the admin order page: Paid → files → submitted, with a sandbox order id.
2. Try a declined card (`4000 0000 0000 0002`): nothing is created as paid.
3. Try an async payment failure: Stripe test mode for a delayed method, or use the fake page locally. The order becomes `failed` and a "payment didn't go through" email is sent.
4. Refund part of an order, then the rest. Both emails arrive, and the order ends `refunded`.
5. In the Prodigi sandbox dashboard, confirm the order shows the right **SKU, size, frame colour and print file**. Download the file and check it at 100%.
6. Advance the sandbox order to shipped (if the sandbox allows). Confirm tracking appears and the shipped email is sent.
7. Scan the printed QR code on a real test print, on iPhone and Android.
8. Replay a webhook from Stripe (Developers → Webhooks → event → Resend). The admin shows it as a duplicate, with no second payment.

⚠ **The Prodigi field names and SKUs in the code follow Prodigi's v4 documentation, but haven't been exercised against the real API** (this build environment had no network access to it). Steps 5–6 are where that gets confirmed. If Prodigi rejects a field, the order shows `fulfillment_failed` with Prodigi's message, and nothing is lost.

## Incidents

| Symptom | What happens automatically | What to do |
|---|---|---|
| Stripe down / slow | Checkout shows "payment provider didn't respond — your cart is saved". Nothing is charged. | Wait. |
| Stripe webhooks delayed or missed | The success page keeps checking. Maintenance asks Stripe directly for orders pending 45+ minutes. | Nothing, unless `/admin/system` shows failed webhooks. |
| Prodigi down | Submission retries with backoff (30 s → 6 h) for about a day, then marks the job dead. The order is flagged. | Retry from admin when Prodigi is back. |
| Email provider down | Email jobs retry with backoff. The order proceeds regardless. | Retry dead email jobs. |
| Storage outage | Uploads show a retryable error. Rendering and submission retry later. | Nothing. |
| Database down | Health check fails. The platform restarts web; nothing can be half-committed (transactions). | Provider status page / restore from PITR if data was lost. |
| Worker down | `/api/health` → `staleJobs` grows. Jobs wait safely in the queue. | Restart the worker process. |

## Recording retention (automatic, every 10 minutes)

- Recordings behind a QR code are kept for as long as the business runs.
- Recordings with no QR code are deleted 90 days after delivery.
- Recordings on cancelled or unpaid orders, and uploads that never became an order, are deleted after 30 days.

The policy is in `src/lib/retention.ts` (unit-tested). Preview a run with `npm run uploads:cleanup`.
