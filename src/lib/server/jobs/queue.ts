import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";

/**
 * Postgres job queue. Enqueue inside the same transaction as the state change
 * that requires the work (transactional outbox): if the transaction commits,
 * the job exists; if it rolls back, it doesn't. Nothing is lost between
 * "payment recorded" and "print file rendered".
 */
export type JobType =
  | "render_order"
  | "submit_fulfillment"
  | "sync_fulfillment"
  | "send_email"
  | "process_webhook"
  | "cleanup";

export interface EnqueueOptions {
  dedupeKey?: string;
  runAt?: Date;
  maxAttempts?: number;
}

export async function enqueue(db: Tx | typeof prisma, type: JobType, payload: Prisma.InputJsonValue, opts: EnqueueOptions = {}) {
  if (opts.dedupeKey) {
    const existing = await db.job.findUnique({ where: { dedupeKey: opts.dedupeKey } });
    if (existing) {
      // A finished job with the same key can be re-armed (e.g. admin retry); an active one is left alone.
      if (existing.status === "succeeded" || existing.status === "dead") {
        return db.job.update({ where: { id: existing.id }, data: { status: "queued", payload, runAt: opts.runAt ?? new Date(), attempts: 0, lastError: null, lockedAt: null, lockedBy: null, finishedAt: null } });
      }
      return existing;
    }
  }
  return db.job.create({ data: { type, payload, dedupeKey: opts.dedupeKey, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 8 } });
}

/** Exponential backoff with jitter: 30s, 1m, 2m, 4m … capped at 6h. */
export function backoffMs(attempt: number): number {
  const base = Math.min(6 * 3600_000, 30_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export interface ClaimedJob {
  id: string;
  type: JobType;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
}

/** Atomically claims up to `n` due jobs. Safe with many concurrent workers. */
export async function claimJobs(workerId: string, n: number): Promise<ClaimedJob[]> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" SET "status" = 'running', "lockedAt" = now(), "lockedBy" = ${workerId}, "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE "status" IN ('queued', 'failed') AND "runAt" <= now()
      ORDER BY "runAt" ASC
      LIMIT ${n}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "attempts", "maxAttempts"`;
  return rows;
}

export async function completeJob(id: string) {
  await prisma.job.update({ where: { id }, data: { status: "succeeded", finishedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null } });
}

export async function failJob(job: ClaimedJob, err: unknown, opts: { retryable?: boolean } = {}) {
  const message = err instanceof Error ? err.message : String(err);
  const dead = opts.retryable === false || job.attempts >= job.maxAttempts;
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: dead ? "dead" : "failed",
      lastError: message.slice(0, 2000),
      runAt: dead ? undefined : new Date(Date.now() + backoffMs(job.attempts)),
      lockedAt: null,
      lockedBy: null,
      finishedAt: dead ? new Date() : null,
    },
  });
  return dead;
}

/** Jobs stuck in "running" (worker crashed mid-job) go back to the queue. */
export async function recoverStuckJobs(olderThanMs = 15 * 60_000): Promise<number> {
  const r = await prisma.job.updateMany({
    where: { status: "running", lockedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "failed", lockedAt: null, lockedBy: null, lastError: "Worker stopped while running this job; retrying.", runAt: new Date() },
  });
  return r.count;
}

/** Thrown by a handler for errors that retrying won't fix (bad data, missing config). */
export class PermanentJobError extends Error {}
