# Credentials, manual setup and launch checklist

## A. Credentials and accounts to provide

Only services the code actually uses are listed. Set them as environment variables on **both** the web and worker processes (see `.env.example`).

### Required

| # | Provider | Purpose | Environment variable | Test or live | Where to get it | Looks like |
|---|---|---|---|---|---|---|
| 1 | PostgreSQL host (Neon / Supabase / RDS / Fly) | Orders, payments, jobs | `DATABASE_URL` (pooled), `DIRECT_URL` (direct) | Separate staging and production databases | Provider console → your database → *Connection string* (choose the pooled/pgbouncer one for `DATABASE_URL`) | `postgresql://user:…@host:5432/db?sslmode=require` |
| 2 | Stripe | Payments, tax, refunds | `STRIPE_SECRET_KEY` | Test first, live before launch | Stripe Dashboard → **Developers → API keys** → Secret key (or create a *restricted key* with write access to Checkout Sessions, Coupons and Refunds, and read access to Payment Intents) | `sk_test_…` / `sk_live_…` (`rk_…` if restricted) |
| 3 | Stripe (webhook) | Confirms payments; syncs refunds and disputes | `STRIPE_WEBHOOK_SECRET` | One for test, one for live | Stripe Dashboard → **Developers → Webhooks** → add endpoint `https://YOUR_DOMAIN/api/webhooks/stripe` (events in `docs/deployment.md`) → *Signing secret* | `whsec_…` |
| 4 | Prodigi | Printing, framing, shipping | `PRODIGI_API_KEY`, `PRODIGI_ENV` | `sandbox` first, then `live` (separate keys) | Prodigi dashboard → **Settings → API** (the sandbox has its own dashboard and key) | a UUID-like key |
| 5 | You generate | Authenticates Prodigi's callbacks | `PRODIGI_CALLBACK_SECRET` | — | `openssl rand -hex 24` | 48 hex characters |
| 6 | Object storage: Cloudflare R2 (or AWS S3) | Private recordings and print files | `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `STORAGE_DRIVER=s3` | Separate buckets for staging and production | R2: Cloudflare → **R2 → Manage R2 API Tokens → Create API token** (Object Read & Write, scoped to the bucket). The account ID for the endpoint is on the R2 overview page. | Access key ID (32 chars) + secret (64 chars) |
| 7 | Resend | Transactional email and sign-in links | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Same key works for both; the domain must be verified | resend.com → **API Keys → Create API Key** (Sending access). `EMAIL_FROM` must use your verified domain. | `re_…` |
| 8 | You generate | Signs order links, storage URLs and tokens | `APP_SECRET` | Different per environment | `openssl rand -base64 48` | 64 random characters |
| 9 | You decide | Who can open /admin | `ADMIN_EMAILS` | — | Comma-separated list of your email(s) | `you@yourdomain.com` |
| 10 | You decide | Canonical site URL (printed in every QR code) | `NEXT_PUBLIC_APP_URL` | — | Your final https domain; **don't change it after the first order ships** | `https://www.yourdomain.com` |

### Recommended

| # | Provider | Purpose | Environment variable | Where to get it | Looks like |
|---|---|---|---|---|---|
| 11 | Sentry | Error monitoring (server, worker, browser) | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | sentry.io → **Projects → Create project (Next.js)** → **Settings → Client Keys (DSN)** | `https://…@o123.ingest.us.sentry.io/456` |
| 12 | Resend (webhook) | Delivery / bounce status in admin | `RESEND_WEBHOOK_SECRET` | resend.com → **Webhooks → Add endpoint** `https://YOUR_DOMAIN/api/webhooks/resend` → signing secret | `whsec_…` |

### Optional (only if you use them)

| # | Provider | Purpose | Environment variable | Where to get it |
|---|---|---|---|---|
| 13 | Google Analytics 4 | Traffic and funnel reporting | `NEXT_PUBLIC_GA4_ID`, `GA4_API_SECRET` | GA4 → Admin → **Data streams** → web stream → Measurement ID; **Measurement Protocol API secrets** → Create |
| 14 | Meta | Ad conversion tracking (consent-gated) | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN` | Events Manager → your dataset → **Settings** → Pixel ID; *Conversions API → Generate access token* |
| 15 | TikTok | Ad conversion tracking (consent-gated) | `NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `TIKTOK_EVENTS_TOKEN` | TikTok Ads Manager → **Assets → Events → Web events** → pixel → Settings → *Generate access token* |

**Not needed:**
- No Stripe publishable key: hosted Checkout doesn't need one.
- No separate tax service: Stripe Tax is used.
- No CAPTCHA: honeypots and rate limits are used.
- No address-validation service.
- No Redis or queue service.
- No AI services.
- Printify, Supabase keys and Etsy from the old `.env` are no longer used.

## B. Manual setup (can't be done in code)

1. **Stripe**
   - Settings → **Business details / Public details**: legal name, support email, statement descriptor (e.g. `AFTERHUM`).
   - Settings → **Branding**: logo and colours (shown on the Checkout page).
   - Settings → **Payment methods**: turn on Cards, **Apple Pay, Google Pay, Link**. Hosted Checkout needs no Apple Pay domain verification.
   - Settings → **Tax**:
     - activate Stripe Tax;
     - set your origin address;
     - add registrations for the states where you must collect (start with your home state; Stripe Tax monitors thresholds);
     - set `STRIPE_TAX_ENABLED=true`.
     - Confirm the product tax code with an accountant (`STRIPE_TAX_CODE`, default general tangible goods).
   - Developers → **Webhooks**: add the endpoint (test and live) with the events in `docs/deployment.md`.
   - Activate live mode (identity and bank details) before launch.
2. **Prodigi**
   - Create the account.
   - Confirm the **product for each of the six variants**: 8×10, 12×16 and 18×24, each as a fine-art print and as a framed print with mount.
     - Put the exact SKUs into Admin → Products. The seeded values (`GLOBAL-FAP-…`, `GLOBAL-CFPM-…`) are placeholders.
     - Confirm the frame colour attribute name and values (seeded: `color` = black/natural/white).
   - Confirm the paper, mount colour, glazing, production time and shipping method. Update lead times in Admin → Products.
   - Add billing (Prodigi charges you per order).
   - Place 2–3 **physical sample orders** before launch.
   - Check whether Prodigi needs a return address or branded packing slip for your account (dashboard settings).
3. **Resend.** Add and verify your sending domain (SPF, DKIM, MX), add a DMARC record, and create the API key. Make sure `support@` receives mail.
4. **DNS.** Point `www` (and the apex) at the host; HTTPS is automatic on the recommended hosts.
5. **Storage.**
   - Create a **private** bucket.
   - Add the **CORS rule** from `docs/deployment.md` (uploads fail without it).
   - Create an API token scoped to the bucket.
6. **Database.** Enable automated backups plus point-in-time recovery, and do one test restore.
7. **Hosting.**
   - Create the app with **two processes (web + worker)**.
   - Set the release command to `npm run release` and the health check to `/api/health`.
   - Add all environment variables.
8. **Business and legal information** (read by the site from environment or copy):
   - `NEXT_PUBLIC_LEGAL_NAME` and `NEXT_PUBLIC_LEGAL_STATE`, used by the Terms and Privacy pages.
   - `NEXT_PUBLIC_BUSINESS_ADDRESS` (optional; shown in email footers).
   - About page: add your real story (there's an `OWNER:` note in `src/app/about/page.tsx`).
   - Contact page: add a phone number only if you want one public (`OWNER:` note).
   - Review the promises in `/terms`, `/privacy`, `/shipping` and `/returns`: 12-hour correction window, 30-day damage/reprint window, reprint-at-cost for approved typos, US-only shipping, and emailing customers a download if you ever close.
9. **Brand name and domain.** The brand is **Afterhum** (chosen 1 Oct 2026, `docs/brand-name-workshop.md`); the site and marketing kit already use it. Still to do: confirm the domain (e.g. `afterhum.com`) is available and buy it, run a USPTO search, and claim @afterhum handles. Decide the domain before the first order ships, because printed QR codes use it.

## C. Launch checklist

### Blocks launch
- [ ] Production database with backups/PITR; `npm run release` succeeds.
- [ ] Private bucket, CORS rule, storage credentials; an upload works from a phone.
- [ ] Stripe **live** keys and live webhook secret. The webhook endpoint shows successful deliveries.
- [ ] Prodigi **live** key; **real SKUs** for all six variants entered; one sandbox order per variant checked (SKU, size, frame colour, file); physical samples received and approved.
- [ ] Resend domain verified; `EMAIL_FROM` set; the confirmation email received in Gmail and Apple Mail (not spam).
- [ ] `APP_SECRET`, `PRODIGI_CALLBACK_SECRET`, `ADMIN_EMAILS` set; `npm run check:env` prints OK in production.
- [ ] Final domain on HTTPS; `NEXT_PUBLIC_APP_URL` set to it.
- [ ] Legal name and state set; Terms/Privacy/Shipping/Returns promises reviewed and accepted by you.
- [ ] Stripe Tax decision made (enabled with registrations, or consciously off after advice).
- [x] Brand name chosen: Afterhum.
- [ ] Afterhum domain bought, USPTO search done, social handles claimed.
- [ ] Rehearsal in test mode completed (`docs/operations.md`), including a refund and a QR scan of a real print.

### Should complete before launch
- [ ] Sentry DSNs set; a test error appears.
- [ ] Resend webhook set (bounces visible in admin).
- [ ] Real product photography replaces the mockups; the About page gets your real story.
- [ ] Prices confirmed against real Prodigi costs (`docs/unit-economics.md`).
- [ ] Holiday order-by dates from Prodigi published.
- [ ] A support mailbox that someone checks daily.
- [ ] Lighthouse run on the live site (homepage, /create, /cart) on a mid-range phone.

### Can complete after launch
- [ ] GA4 / Meta / TikTok IDs (the first-party funnel works without them).
- [ ] Express shipping (`SHIPPING_EXPRESS_CENTS`) once the Prodigi express cost is known.
- [ ] Abandoned-cart reminder emails. The data is captured with explicit consent (`Cart.recoveryConsent`); sending isn't built on purpose.
- [ ] Customer reviews, once real ones exist (`src/lib/reviews.ts`).
- [ ] Saved addresses pre-filling Stripe Checkout (needs Stripe Customer objects).
- [ ] Nonce-based CSP (removes `'unsafe-inline'` for scripts; makes every page dynamic).
