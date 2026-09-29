/**
 * Runs once when the server boots: validates the environment (a production
 * server refuses to start half-configured) and starts Sentry if configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("./lib/server/env");
  getEnv();
  const { initSentryNode } = await import("./lib/server/sentry");
  await initSentryNode();
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
}
