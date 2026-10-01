# Afterhum store

Personalised keepsake art made from the sound of a customer's own recording or video. The customer uploads a memory, customises a finished design (The Night Of / Herbarium), orders a print or framed print, and we render a 300-DPI print file and send it to the print lab (Prodigi), with tracking and emails throughout.

- **Customer app:** Next.js 16 (App Router) + React 19 + Tailwind.
- **Data:** PostgreSQL via Prisma.
- **Files:** private S3-compatible bucket.
- **Background work:** a worker process on a Postgres job queue.
- **Providers:** Stripe Checkout, Prodigi, Resend, Sentry.

| Doc | What's in it |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How it fits together: data model, order flow, state machine, security |
| [docs/deployment.md](docs/deployment.md) | Hosting, environment, webhooks, DNS, migrations, backups |
| [docs/operations.md](docs/operations.md) | Runbook: refunds, retries, takedowns, incidents, provider tests |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Credentials you need to provide + launch checklist |
| [docs/analytics-plan.md](docs/analytics-plan.md) | Funnel events and attribution |

## Run it locally

Requires Node 20.9+, PostgreSQL 14+ and Chromium. Chromium is only needed for rendering print files in the worker; `npx playwright install chromium` provides one.

```bash
cp .env.example .env            # set DATABASE_URL, DIRECT_URL and ADMIN_EMAILS=you@example.com
npm install                     # also runs prisma generate
npm run db:deploy               # apply migrations
npm run db:seed                 # catalogue, design templates, DEVTEST10 code (dev only)
npm run dev                     # http://localhost:3000
npm run worker                  # second terminal: renders print files, "submits" to the mock lab, writes emails
```

With no provider keys set, development runs end to end on local stand-ins:

| Service | Dev stand-in | Where to look |
|---|---|---|
| Stripe | fake checkout page that sends **signed Stripe-format webhooks** to the real handler | `/dev/checkout/…` |
| Prodigi | mock lab: submitted → in production (1 min) → shipped (2 min) | `/admin/fulfillment` |
| Resend | emails written to disk | `storage/emails/*.html` |
| S3 | local folder + signed URLs | `storage/objects/` |

**Admin:** go to `/admin`, enter an email listed in `ADMIN_EMAILS`, and open the sign-in link from `storage/emails/*login_link.html`.

## Commands

| | |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Next.js dev / production build / production server (`PORT`) |
| `npm run worker` | Background worker (`-- --once` runs what's due, then exits) |
| `npm run db:migrate` | Create a migration from `prisma/schema.prisma` changes (development) |
| `npm run db:deploy` | Apply migrations (production: runs in `npm run release`) |
| `npm run db:seed` | Idempotent catalogue seed (`-- --force` overwrites prices/SKUs) |
| `npm run check:env` | Validate environment exactly as production boot does |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:unit` | Pricing, discounts, state machine, security, retention, print files, lab mapping |
| `npm run test:art` | Artwork engine (282 checks) |
| `npm run test:db:prepare && npm run test:integration` | Postgres-backed: webhooks, idempotency, refunds, fulfillment, queue, rate limits |
| `npm run test:e2e` | Browser: studio → cart → checkout → webhook → render → lab → email (needs `npm run dev`) |
| `npm run test:security` | IDOR, CSRF, webhook spoofing, upload validation, headers (needs `npm run dev`) |
| `npm run uploads:cleanup` | Apply recording retention now (dry run; `-- --apply`) |
| `npm run uploads:remove -- SW-10001 --apply` | Takedown: delete a recording and disable its QR code |

## Repository map

```
src/app/                 pages + API routes (api/*: uploads, projects, cart, checkout, webhooks, auth, account, contact…)
src/app/admin/           internal admin (gated), server actions in admin/actions.ts
src/components/studio/   the customiser (Studio.tsx) and upload pipeline (useMemoryUpload.ts)
src/lib/art/             artwork engine — the same code renders previews and print files
src/lib/commerce.ts      pure pricing / discount rules (client display + server authority)
src/lib/server/          server-only modules: env, db, auth, storage, cart, orders/, payments/,
                         fulfillment/, email/, jobs/, render/, retention, rate limiting, logging
scripts/worker.ts        the worker process
prisma/                  schema, migrations, seed
tests/                   unit/, integration/, e2e/
```
