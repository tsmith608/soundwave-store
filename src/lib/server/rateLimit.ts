import { prisma } from "./db";
import { AppError } from "./http";
import { log } from "./log";

/**
 * Fixed-window rate limiter stored in Postgres, so it works across any number
 * of stateless web instances without Redis. Limits are generous: they stop
 * abuse and scripted guessing, not normal customers.
 */
export const LIMITS = {
  upload: { limit: 30, windowSec: 3600 },
  checkout: { limit: 20, windowSec: 3600 },
  discount: { limit: 15, windowSec: 900 },
  login: { limit: 5, windowSec: 900 },
  contact: { limit: 5, windowSec: 3600 },
  cart: { limit: 300, windowSec: 3600 },
  project: { limit: 600, windowSec: 3600 },
  track: { limit: 20, windowSec: 900 },
  events: { limit: 600, windowSec: 3600 },
} as const;

export async function rateLimit(bucket: keyof typeof LIMITS, subject: string): Promise<void> {
  const { limit, windowSec } = LIMITS[bucket];
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const key = `${bucket}:${subject}`;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"`;
    if ((rows[0]?.count ?? 0) > limit) {
      throw new AppError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    // Fail open: a limiter outage must not block real customers from checking out.
    log.warn("rate_limit_unavailable", { bucket, err: e });
  }
}

export async function pruneRateLimits(): Promise<number> {
  const r = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } });
  return r.count;
}
