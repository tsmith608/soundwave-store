import { NextResponse } from "next/server";
import { getOwner, ownsRecord } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, route } from "@/lib/server/http";
import { deleteAssetBytes } from "@/lib/server/media";
import { storage } from "@/lib/server/storage";

async function load(id: string) {
  const owner = await getOwner(false);
  const asset = await prisma.uploadedAsset.findUnique({ where: { id } });
  if (!asset || !ownsRecord(owner, asset)) throw new AppError(404, "not_found", "Recording not found.");
  return asset;
}

/** Owner-only playback of their own recording via a 5-minute signed URL. */
export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const asset = await load((await ctx.params).id);
  if (asset.status !== "ready") throw new AppError(410, "gone", "This recording is no longer available.");
  const url = await (await storage()).presignGet(asset.storageKey, { expiresIn: 300 });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store" } });
});

/** Customer deletes their own upload. Recordings already attached to a paid order are kept (the printed code needs them) unless removed via support. */
export const DELETE = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const asset = await load((await ctx.params).id);
  const ordered = await prisma.orderItem.count({ where: { audioAssetId: asset.id, order: { status: { notIn: ["pending_payment", "cancelled", "failed"] } } } });
  if (ordered) throw new AppError(409, "in_use", "This recording belongs to an order. Email us and we'll remove it and switch off the code.");
  await prisma.project.updateMany({ where: { audioAssetId: asset.id }, data: { audioAssetId: null, peaks: undefined } });
  await deleteAssetBytes(asset.id, "customer_request");
  return NextResponse.json({ deleted: true });
});
