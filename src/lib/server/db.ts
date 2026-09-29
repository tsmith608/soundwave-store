import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

/**
 * One Prisma client per process. For serverless/pooled Postgres (Supabase
 * pgbouncer, Neon) use the pooled URL in DATABASE_URL (with
 * ?pgbouncer=true&connection_limit=5) and the direct URL in DIRECT_URL for
 * migrations.
 */
export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
