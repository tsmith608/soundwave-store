# Production Build — Audit & Implementation Plan

29 Sep 2026. This plan comes before any code changes.

## Audit summary

| Area | Found | Verdict |
|---|---|---|
| Framework | Next.js 16.1 App Router, React 19, TypeScript, Tailwind 3 | Keep |
| Database | Prisma 6 + PostgreSQL; 2 migrations; one wide `Order` table with string status | **Replace with a real commerce schema** (new migration) |
| Auth | None | Add passwordless email sign-in (magic link) for customers and admins |
| Customizer | `src/components/studio/Studio.tsx` + SVG art engine `src/lib/art` (preview = print renderer) | **Keep. It is the heart of the product.** Add cart, autosave, undo and server projects. |
| Media upload | Browser extracts sound, then POSTs the whole file to `/api/upload`, which writes to local `storage/` | Replace with signed direct-to-object-storage upload plus a verification step |
| Payments | Stripe Checkout skeleton; hand-rolled signature check that **accepts public test secrets outside production**; single item; no tax | Rebuild: cart → server pricing → Checkout Session; SDK signature verification; idempotent handlers |
| Fulfillment | Python `backend/` (Prodigi / Printify / mock) spawned from the webhook. **Uses `sqlite3`, so it can't read the Postgres DB** (documented launch blocker). Detached child processes don't survive serverless or restarts. | Replace with a TypeScript worker + job queue, keeping **Prodigi** as the provider (fine-art framed prints with mounts). |
| Print files | TS renderer → vector PDF via Chromium (`scripts/render-art.ts`) | Keep; call it from the worker; add a 300-DPI PNG for the lab plus bleed |
| Email | Python Resend sender; Resend webhook route (svix) | TS Resend client + templates + queued, deduplicated sends |
| Etsy | OAuth + receipt import that treats a buyer's message URL as the audio source | **Remove.** It was never configured, and it conflicts with the policy of never using streaming/URL audio. |
| Analytics | First-party `/api/events`; GA4/Meta/TikTok consent-gated; server CAPI forwarding | Keep; add funnel events, UTM attribution to carts and orders |
| SEO | Titles, canonicals, sitemap, robots, FAQ JSON-LD | Extend: Organization, Product, Breadcrumb, OG/Twitter defaults |
| Legal | `/terms`, `/privacy` | Add shipping, returns, contact, about, FAQ, cookies |
| Dead code | `PortraitBuilder`, `WaveformCanvas`, `AudioRecorder`, `PricingTable`, `Hero`, `HowItWorks`, `UseCases`, `motion/*` (framer-motion), `lib/constants.ts`, `lib/pseo`, legacy checkout branch, Python backend, legacy test suites for these, `better-sqlite3`, `lucide-react`, `uuid` | Remove |
| Deployment | README describes Vercel, which can't run Chromium/worker/persistent files | Container (Docker) for web + worker; managed Postgres; S3-compatible storage |

## Target architecture

- **Web:** a Next.js server, stateless. Everything durable lives in Postgres or object storage.
- **Worker:** `npm run worker`, the same codebase in a separate process. It runs a Postgres-backed job queue (`FOR UPDATE SKIP LOCKED`) with retries and backoff:
  - rendering print files
  - fulfillment submission
  - email sending
  - reconciliation
  - clean-up
- **Storage:** an S3-compatible private bucket (AWS S3, Cloudflare R2 or Supabase Storage). Browsers upload with presigned PUT URLs; downloads use short-lived presigned GETs. In development a local driver has the same interface.
- **Payments:** Stripe Checkout (cards, Apple Pay, Google Pay and Link come automatically).
  - Stripe Tax is enabled by a flag.
  - The webhook is authoritative.
  - A dev-only "fake Stripe" signs real Stripe-format events, so the whole flow runs locally and in E2E tests without keys.
- **Fulfillment:** a provider interface with Prodigi (sandbox/live) and mock adapters, idempotency keys, callbacks, polling reconciliation and admin retry.
- **Email:** Resend over REST. There's a file-based dev driver, and every message is logged in `EmailMessage` with a dedupe key.
- **Auth:** magic-link sessions. Cookies are HttpOnly, SameSite=Lax and Secure in production. Admin access requires an email listed in `ADMIN_EMAILS`.
- **Security:** security headers + CSP, a DB-backed rate limiter, zod validation, env validation, HMAC order-access tokens, and no raw errors shown to users.
- **Observability:** a JSON logger with redaction, and Sentry (inactive until a DSN is set).

## Phases (each committed separately)

1. Foundations: env, logger, validation, rate limit, security headers, storage driver.
2. Schema + migration + seed (products/variants/templates/discounts).
3. Media pipeline (signed upload + verification) + projects + autosave/undo in the studio.
4. Cart + pricing + discounts + checkout + Stripe webhook + order state machine.
5. Worker: print rendering, Prodigi fulfillment, shipments, emails, reconciliation, clean-up.
6. Accounts, order tracking, admin.
7. Storefront pages, SEO, analytics funnel, accessibility/mobile pass.
8. Dead-code removal, tests (unit, integration, E2E), Docker/deploy, docs, final QA.
