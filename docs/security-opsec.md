# Security and OpSec

**Updated 2 Oct 2026.** This covers two things:
- **What the code already enforces.** Done; it's listed so you know it exists.
- **What only you can do.** Accounts, keys and habits. Most real-world breaches of small shops happen here, not in the code.

## 1. What the code enforces

| Area | Protection |
|---|---|
| **Admin access** | Every `/admin` page and every admin action checks for a signed-in user whose email is listed in `ADMIN_EMAILS`. Removing an email revokes access immediately. |
| **Admin session length** | **12 hours** (`ADMIN_SESSION_HOURS`), however active, after which you sign in again. Customer sessions stay 30 days. |
| **Admin IP lock (optional)** | Set `ADMIN_IP_ALLOWLIST` to your home IP(s) and nobody else can open `/admin`, even with your email. |
| **Admin audit log** | Every admin action (refund, cancel, edit, takedown) is recorded with who, what and IP. The database **refuses edits or deletes** of the log. |
| **Destructive admin actions** | Refunds, cancellations and recording removal require typing the order number. Refunds use Stripe idempotency keys, so a double click can't refund twice. |
| **Sign-in** | Email magic links with 256-bit random tokens, single-use, expiring in 20 minutes. Only hashes are stored. Throttled to 3 per email and 5 per IP per 15 minutes. The response never reveals whether an account exists. |
| **Session cookies** | HttpOnly, SameSite=Lax, Secure. In production the session cookie has the `__Host-` prefix, so no subdomain can set or read it. Only a hash of the session token is stored, so a database leak can't be replayed. |
| **Cross-site attacks** | JSON endpoints reject requests from other sites (Origin and `Sec-Fetch-Site` checks), as do logout and newsletter signup. Server actions have Next.js's built-in origin check. |
| **Rate limits** | Login, checkout, discount codes, uploads, contact and order lookup. The client IP is read from your host's trusted header (`TRUSTED_IP_HEADER`) or the last proxy hop, so attackers can't fake IPs to dodge limits. |
| **Security headers** | Content-Security-Policy, HSTS (2 years, preload), X-Frame-Options DENY, nosniff, a strict referrer policy, and a Permissions-Policy limiting browser features (microphone allowed for in-browser recording). Private pages are noindex and no-store. |
| **Uploads** | Signed upload URLs only; a 12 MB and 3-minute cap; file type checked by its actual bytes, not the name; random storage keys in a private bucket. |
| **Recordings** | Played only through a 96-bit unguessable link that redirects to a 10-minute signed URL. Removal is supported (410 Gone). |
| **Webhooks** | Stripe uses SDK signature verification; email events use timing-safe HMAC (svix); Prodigi uses a constant-time secret comparison. Duplicates are ignored (unique event IDs). |
| **Payments** | Prices are computed on the server; the browser never sets a price. Stripe's webhook is the only thing that marks an order paid. |
| **Config** | Production refuses to start without `APP_SECRET`, real Stripe, Prodigi and email keys, HTTPS and an admin email. Test payments, mock printing and file email are blocked. The validation skip works only during the Docker build. |
| **Errors and logs** | Customers see plain messages and never stack traces. Logs redact secrets. |
| **Database integrity** | Orders' payments, refunds, items, lab orders, shipments and history **can't be deleted along with an order**. The database blocks negative money, refunds above the order total, out-of-range discounts and zero-price products. |

**Tests:** `npm run test:unit` (49, including security), `npm run test:integration` (19, real Postgres), `npm run test:security` (end-to-end header and abuse checks against a running server).

## 2. What you must do (before launch)

### Accounts: turn on two-factor authentication everywhere
Use an **authenticator app** (or a hardware key such as a YubiKey), **not SMS**. SIM-swap attacks target SMS. In order of importance:
1. **The email inbox in `ADMIN_EMAILS`.** Whoever controls this inbox controls your admin panel, because sign-in is by emailed link. Use a dedicated admin address, not one you give out publicly.
2. **Domain registrar.** Turn on 2FA and **registrar lock / transfer lock**. A stolen domain means stolen checkout and stolen QR links.
3. **Stripe.** Use 2FA, and add teammates as limited users, never by sharing your login.
4. **Hosting** (Fly, Railway or similar), **database host**, **Cloudflare R2 / S3**.
5. **GitHub.** Use 2FA, and protect the main branch.
6. **Prodigi, Resend, Sentry**, and the social accounts (TikTok, Instagram, Facebook, Pinterest).

Store backup codes in a password manager (1Password or Bitwarden). Use a password manager for every login, with no reused passwords.

### Keys
- **Stripe: use a restricted key** (`rk_live_…`), not the full secret key. Permissions: Checkout Sessions write, Coupons write, Refunds write, Payment Intents read. `docs/launch-checklist.md` lists them.
- **Storage key** scoped to the one bucket, with object read and write only.
- **Never paste keys into chat, email, screenshots or GitHub.** They go only into your host's environment-variable settings. `.env` is git-ignored and Docker-ignored; keep it that way.
- **Rotate** `APP_SECRET`, `PRODIGI_CALLBACK_SECRET` and the API keys if a laptop is lost, someone leaves, or anything leaks. Rotating `APP_SECRET` signs everyone out and invalidates outstanding order links; that's expected.

### Database
- **Least privilege.** Run migrations with the owner role (`DIRECT_URL`), but give the app a separate role that can read and write rows and **can't** drop, alter or truncate tables:
  ```sql
  CREATE ROLE app_rw LOGIN PASSWORD '<long random>';
  GRANT CONNECT ON DATABASE <db> TO app_rw;
  GRANT USAGE ON SCHEMA public TO app_rw;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
  ```
  Then use `app_rw` in `DATABASE_URL`. This also makes the audit log truly tamper-proof, since only the owner role can truncate it.
- **Backups and point-in-time recovery on**, and **one test restore** before launch.
- The database should require TLS (`sslmode=require`); every managed host does by default.

### Hosting and network
- Set `TRUSTED_IP_HEADER` for your host: `fly-client-ip` on Fly, `cf-connecting-ip` behind Cloudflare. Without it the app falls back to the last proxy hop, which is safe but less precise.
- Optional: set `ADMIN_IP_ALLOWLIST` to your home IP. If your IP changes often, skip it; the 12-hour admin sessions and email 2FA already cover most of the risk.
- Turn on Cloudflare (free plan) in front of the site for DDoS protection and bot filtering.

### Email (also protects customers from phishing in your name)
- SPF, DKIM and **DMARC** records for your domain, starting with `p=quarantine`. Resend's setup walks through SPF and DKIM.

### Habits
- **Admin from your own devices only.** Not shared or library computers.
- **Phishing:** Stripe, Prodigi and your host will never ask for your password by email. Sign in by typing the address yourself.
- **Every quarter:** review who has access to Stripe, the host, GitHub and admin, and remove anyone who shouldn't.
- **Customer data requests** (deletion, removing a recording) are handled in admin. Log them, and reply within two business days (your Terms promise this).

## 3. If something goes wrong

1. **Suspected admin compromise:**
   - Remove the email from `ADMIN_EMAILS` and redeploy. Access stops immediately.
   - Rotate `APP_SECRET`, which signs everyone out.
   - Change the email password and 2FA.
   - Check `/admin/system` (audit log) for actions you didn't take.
2. **Leaked API key:** revoke it in the provider's dashboard first, then create a new one and update the host's settings.
3. **Stripe dispute spike or fraud:** turn on Radar rules in Stripe, such as blocking orders where the billing and shipping countries differ, if that pattern appears.
4. **Write down what happened and when.** If customer data was exposed, US state breach-notification laws may require you to tell affected customers. Get legal advice at that point.

## 4. Known, accepted trade-offs

- **The CSP allows inline scripts** (`'unsafe-inline'`), because statically rendered Next.js pages need it. React escapes all user content and no user HTML is rendered, so the risk is low. A nonce-based CSP is on the post-launch list.
- **The rate limiter fails open** if the database is down, so a limiter glitch never blocks real customers from paying. When the database is down nothing works anyway.
- **Customer sessions last 30 days** for convenience; admin sessions are 12 hours.
