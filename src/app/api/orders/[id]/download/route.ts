import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/db";
import { clientIp } from "@/lib/server/http";
import { checkOrderAccessToken } from "@/lib/server/orders/access";
import { rateLimit } from "@/lib/server/rateLimit";
import { storage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * Download an order item's digital file (PNG or PDF). The order access token from
 * the emailed link is the capability; the redirect is a 10-minute signed URL, so
 * no file is ever publicly reachable. Paid orders only; not after a cancellation
 * or full refund.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "pdf" ? "digital_pdf" : "digital_png";
  const itemId = sp.get("item") ?? "";
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !/^[a-z0-9]{10,40}$/i.test(itemId) || !checkOrderAccessToken(id, sp.get("t"))) {
    return NextResponse.json({ error: "This download link isn't valid." }, { status: 404 });
  }
  try {
    await rateLimit("track", clientIp(req));
  } catch {
    return NextResponse.json({ error: "Too many downloads. Please wait a few minutes." }, { status: 429 });
  }
  const order = await prisma.order.findUnique({ where: { id }, select: { number: true, paidAt: true, status: true } });
  if (!order || !order.paidAt || ["cancelled", "refunded", "failed"].includes(order.status)) {
    return NextResponse.json({ error: "This download isn't available." }, { status: 404 });
  }
  const asset = await prisma.generatedAsset.findFirst({
    where: { kind, orderItem: { id: itemId, orderId: id } },
    orderBy: { createdAt: "desc" },
    select: { storageKey: true },
  });
  if (!asset) return NextResponse.json({ error: "Your file is still being prepared. Please try again in a few minutes." }, { status: 404 });
  const ext = kind === "digital_pdf" ? "pdf" : "png";
  const url = await (await storage()).presignGet(asset.storageKey, { expiresIn: 600, downloadName: `${order.number}-artwork.${ext}` });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
}
