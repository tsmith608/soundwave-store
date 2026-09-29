# Deployment

## What you run

| Piece | Recommendation | Why |
|---|---|---|
| App container (this repo's `Dockerfile`) | Fly.io, Railway, Render or any VM. Run **two processes from the same image**: `web` (`npm start`) and `worker` (`npm run worker`). | The worker needs Chromium (in the image) and runs continuously. Serverless platforms (Vercel) can host `web` but **not** the worker. |
| PostgreSQL 14+ | Managed, with automatic backups and point-in-time recovery: Neon, Supabase, Fly Postgres, AWS RDS | Orders, payments and the job queue |
| Object storage | Cloudflare R2 (no egress fees) or AWS S3, **private** bucket | Recordings and print files |
| Stripe · Prodigi · Resend · Sentry | See `docs/launch-checklist.md` | Payments · printing · email · errors |

Sizing to start: web 1 × 1 GB, worker 1 × 2 GB, Postgres smallest paid tier with PITR.

## First deploy

1. **Create the services** and collect credentials (the checklist in `docs/launch-checklist.md` says exactly where each one is).
2. **Environment.** Set every "Required in production" variable from `.env.example` on both processes.
   - `NEXT_PUBLIC_*` values are compiled into the site, so also pass them as **build args** (see `Dockerfile`, `fly.toml.example`).
   - Run `npm run check:env` with the production values; it must print `OK`.
3. **Release command:** `npm run release`. This runs `prisma migrate deploy` then the idempotent seed. Configure it as the platform's release/pre-deploy step so it runs before new versions start.
4. **Deploy** web + worker. Check:
   - `GET /api/health` → `{"ok":true,"db":"up"}`.
   - `/admin` → sign in with an `ADMIN_EMAILS` address.
   - The dashboard header shows `Payments: stripe · Fulfillment: prodigi (sandbox) · Email: resend · Storage: s3`.
5. **Webhooks** (below), then **DNS and email** (below).
6. **Test mode end to end** with Stripe test keys and the Prodigi sandbox; see "Pre-launch rehearsal" in `docs/operations.md`.
7. **Go live:** swap to live Stripe keys and webhook secret, `PRODIGI_ENV=live` with the live key, and redeploy.

## Webhooks and callbacks

| Provider | Where | URL | Events / notes | Secret → env |
|---|---|---|---|---|
| Stripe | Dashboard → Developers → **Webhooks** → Add endpoint | `https://YOUR_DOMAIN/api/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `payment_intent.payment_failed` | Signing secret `whsec_…` → `STRIPE_WEBHOOK_SECRET` (test and live endpoints have **different** secrets) |
| Prodigi | Nothing to configure: the app sends a `callbackUrl` with each order | `https://YOUR_DOMAIN/api/webhooks/prodigi?token=…` | Status and shipment callbacks; the app re-fetches from the API | You invent `PRODIGI_CALLBACK_SECRET` (16+ random characters) |
| Resend (optional) | resend.com → **Webhooks** → Add endpoint | `https://YOUR_DOMAIN/api/webhooks/resend` | `email.delivered`, `email.bounced`, `email.complained`, `email.failed` | Signing secret → `RESEND_WEBHOOK_SECRET` |

## Storage bucket setup

**Cloudflare R2**
1. R2 → **Create bucket** (e.g. `soundwave-prod`). Leave public access **off**.
2. R2 → **Manage R2 API Tokens** → Create API token → *Object Read & Write*, scoped to that bucket.
   - Copy the **Access Key ID** into `S3_ACCESS_KEY_ID`.
   - Copy the **Secret Access Key** into `S3_SECRET_ACCESS_KEY`.
3. Set the rest of the storage env:
   - `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_BUCKET=soundwave-prod`
   - `STORAGE_DRIVER=s3`
4. Bucket → Settings → **CORS policy**. This is required, because browsers upload directly:
   ```json
   [{ "AllowedOrigins": ["https://www.yourdomain.com"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
5. Optional lifecycle rule: abort incomplete multipart uploads after 1 day. **Don't** add expiry rules on `uploads/` or `renders/`, because the app manages retention: QR recordings must be kept.

**AWS S3**
- Create a bucket with "Block all public access" **on**.
- Create an IAM user whose policy allows `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` and `s3:ListBucket` on that bucket, and use its access keys.
- Set `S3_REGION` to the bucket's region and leave `S3_ENDPOINT` empty.
- Add the same CORS rule (S3 console → Permissions → CORS).

## Domain, HTTPS and email DNS

- **Web:** point `www.yourdomain.com` (and the apex, redirecting) at the host; the platform issues HTTPS.
  - Set `NEXT_PUBLIC_APP_URL=https://www.yourdomain.com`.
  - **Printed QR codes contain this domain, so it must never change after the first order ships.**
- **Email:** Resend → **Domains** → Add `yourdomain.com` (or `mail.yourdomain.com`).
  - Add the DNS records it shows (SPF/DKIM TXT, MX for bounces) and wait for **Verified**.
  - Add a DMARC record: `_dmarc TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`, tightening it later.
  - Set `EMAIL_FROM="Your Brand <orders@yourdomain.com>"` and `EMAIL_REPLY_TO=support@yourdomain.com`.
  - Make sure the support mailbox exists and is monitored; replies and contact-form notifications go there.

## Database: connections, migrations, backups

- **Pooling.**
  - `DATABASE_URL` should be the **pooled** connection string. For Supabase or Neon, add `?pgbouncer=true&connection_limit=5`.
  - `DIRECT_URL` is the direct connection, used only by migrations.
- **Migrations.**
  - Schema changes are made in `prisma/schema.prisma` → `npm run db:migrate -- --name what_changed` (locally) → commit the generated folder.
  - Production only ever runs `prisma migrate deploy` (in `npm run release`). Never edit a production schema by hand.
  - Prefer additive migrations: add a column, deploy code that writes both, backfill, then remove old columns in a later release.
- **Backups.** Turn on automatic daily backups plus point-in-time recovery (7+ days) at the database provider. Test a restore into a scratch database before launch and once a quarter.
- **Object storage durability.** R2 and S3 are 11-nines durable. For a second copy of the irreplaceable data, enable bucket versioning, or run a weekly `rclone sync` of `renders/` and `uploads/` to another bucket.

### What you need to restore the business

| Data | Where | Why it matters |
|---|---|---|
| Orders, items (`artworkSpec` snapshots), payments, refunds | Postgres | Money and legal records; the exact purchased design |
| Fulfillment ids, shipments, tracking | Postgres | Customer support; reconciling with Prodigi |
| Production print files (`renders/`) | Bucket | Reprints without re-rendering |
| Recordings behind QR codes (`uploads/`) | Bucket | Printed codes play them; they can't be regenerated |
| Stripe and Prodigi dashboards | Providers | Independent records to cross-check after an incident |

Everything else (carts, drafts, jobs, sessions, rate limits) can be lost without harm.

## Scaling and operations

- Web instances are stateless: add more behind the load balancer.
- Workers can run in parallel. Each one renders with Chromium and needs about 2 GB of memory.
- Watch `/admin/system` and Sentry. `GET /api/health` returns `staleJobs`; a growing number means the worker is down.
