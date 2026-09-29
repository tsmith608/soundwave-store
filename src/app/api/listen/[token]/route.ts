import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { storage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * Plays the recording behind a printed code: redirects to a 10-minute signed
 * URL (never a permanent public link). The token is the capability.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return new NextResponse(null, { status: 404 });
  const item = await prisma.orderItem.findUnique({ where: { listenToken: token }, include: { audioAsset: true, order: { select: { status: true, paidAt: true } } } });
  if (!item || !item.order.paidAt || item.order.status === "cancelled") return new NextResponse(null, { status: 404 });
  if (item.recordingRemovedAt || !item.audioAsset || item.audioAsset.status !== "ready") return new NextResponse(null, { status: 410 });
  const url = await (await storage()).presignGet(item.audioAsset.storageKey, { expiresIn: 600 });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
}
