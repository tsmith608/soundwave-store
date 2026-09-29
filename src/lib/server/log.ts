/**
 * Structured JSON logger. One line per event so hosting log search and
 * Sentry breadcrumbs can index fields. Secrets and personal data are
 * redacted by key name; never pass raw card data, tokens or signed URLs.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === "production" ? "info" : "debug")] ?? 20;

const REDACT = /(secret|token|password|authorization|cookie|api[_-]?key|signature|card|cvc|url|address|phone)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value instanceof Error) return { name: value.name, message: value.message, stack: process.env.NODE_ENV === "production" ? undefined : value.stack };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) && typeof v === "string" ? "[redacted]" : scrub(v, depth + 1);
    return out;
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(fields ? (scrub(fields) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => write("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => {
    write("error", msg, f);
    void reportError(msg, f);
  },
};

/** Forwards errors to Sentry when configured. Never throws. */
async function reportError(msg: string, fields?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    const err = fields?.err instanceof Error ? fields.err : new Error(msg);
    Sentry.captureException(err, { extra: scrub(fields) as Record<string, unknown>, tags: { msg } });
  } catch {
    /* monitoring must never break the request */
  }
}
