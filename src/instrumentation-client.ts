/** Browser error monitoring. Loaded only when NEXT_PUBLIC_SENTRY_DSN is set (no bundle cost otherwise). */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: 0.05,
      // Never capture form input or recordings.
      beforeBreadcrumb: (b) => (b.category === "ui.input" ? null : b),
    }),
  );
}
export {};
