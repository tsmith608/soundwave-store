import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability for the platform health check. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const queued = await prisma.job.count({ where: { status: { in: ["queued", "failed"] }, runAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
    return NextResponse.json({ ok: true, db: "up", staleJobs: queued }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
