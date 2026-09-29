/**
 * Background worker: runs queued jobs (print rendering, fulfillment, email,
 * webhook retries) and periodic maintenance. Run as a separate process from
 * the web server:  npm run worker
 * Any number of workers can run; jobs are claimed with SKIP LOCKED.
 *   --once   process everything currently due, then exit (tests / cron)
 */
import "./_env";
import os from "os";
import { claimJobs, completeJob, enqueue, failJob, PermanentJobError, type JobType } from "../src/lib/server/jobs/queue";
import { runJob } from "../src/lib/server/jobs/handlers";
import { prisma } from "../src/lib/server/db";
import { getEnv } from "../src/lib/server/env";
import { log } from "../src/lib/server/log";
import { initSentryNode } from "../src/lib/server/sentry";

const env = getEnv();
const workerId = `${os.hostname()}:${process.pid}`;
const once = process.argv.includes("--once");
let stopping = false;

async function tick(): Promise<number> {
  const jobs = await claimJobs(workerId, env.WORKER_CONCURRENCY);
  await Promise.all(
    jobs.map(async (job) => {
      const started = Date.now();
      try {
        const key = (await prisma.job.findUnique({ where: { id: job.id }, select: { dedupeKey: true } }))?.dedupeKey ?? `job:${job.id}`;
        await runJob(job.type as JobType, (job.payload ?? {}) as Record<string, unknown>, key);
        await completeJob(job.id);
        log.info("job_done", { jobId: job.id, type: job.type, ms: Date.now() - started });
      } catch (err) {
        const dead = await failJob(job, err, { retryable: !(err instanceof PermanentJobError) });
        (dead ? log.error : log.warn)(dead ? "job_dead" : "job_failed", { jobId: job.id, type: job.type, attempt: job.attempts, err });
      }
    }),
  );
  return jobs.length;
}

async function scheduleMaintenance() {
  // One maintenance job per 10-minute slot, however many workers are running.
  const slot = Math.floor(Date.now() / 600_000);
  await enqueue(prisma, "cleanup", {}, { dedupeKey: `cleanup:${slot}`, maxAttempts: 1 });
}

async function main() {
  await initSentryNode();
  log.info("worker_started", { workerId, concurrency: env.WORKER_CONCURRENCY, fulfillment: env.fulfillmentProvider, email: env.emailProvider, storage: env.STORAGE_DRIVER });
  if (once) {
    await scheduleMaintenance();
    for (let i = 0; i < 50 && (await tick()) > 0; i++);
    await prisma.$disconnect();
    return;
  }
  let lastMaint = 0;
  while (!stopping) {
    if (Date.now() - lastMaint > 600_000) {
      await scheduleMaintenance().catch((err) => log.warn("maintenance_schedule_failed", { err }));
      lastMaint = Date.now();
    }
    const n = await tick().catch((err) => {
      log.error("worker_tick_failed", { err });
      return 0;
    });
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  await prisma.$disconnect();
  log.info("worker_stopped", { workerId });
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stopping = true));
main().catch((err) => {
  log.error("worker_crashed", { err });
  process.exit(1);
});
