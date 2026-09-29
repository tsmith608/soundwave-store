/** Shared Sentry options. No PII: customer words, emails and URLs are stripped before sending. */
export const SENTRY_SCRUB = /(email|address|phone|name|fields|message|token|secret|authorization|cookie|url)/i;

export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
    sendDefaultPii: false,
    beforeSend(event: { request?: { cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown }; extra?: Record<string, unknown> }) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) for (const k of Object.keys(event.request.headers)) if (SENTRY_SCRUB.test(k)) delete event.request.headers[k];
      }
      if (event.extra) for (const k of Object.keys(event.extra)) if (SENTRY_SCRUB.test(k)) event.extra[k] = "[scrubbed]";
      return event;
    },
  };
}

export async function initSentryNode() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions(dsn) as unknown as Parameters<typeof Sentry.init>[0]);
}
