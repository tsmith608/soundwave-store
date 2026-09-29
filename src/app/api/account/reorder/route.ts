import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser, getOwner } from "@/lib/server/auth";
import { addItem } from "@/lib/server/cart";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, parseJson, route, z } from "@/lib/server/http";

/** Copies a purchased design into a new draft project and adds it to the cart. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "signin", "Please sign in to reorder.");
  const { orderItemId } = await parseJson(req, z.object({ orderItemId: z.string().max(40) }));
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true, audioAsset: true, variant: true } });
  if (!item || item.order.userId !== user.id) throw new AppError(404, "not_found", "Order item not found.");
  if (!item.audioAsset || item.audioAsset.status !== "ready") throw new AppError(410, "no_audio", "The recording for this piece is no longer stored. Start a new design with your recording.");
  const spec = item.artworkSpec as { designId: string; colorwayId: string; fields: Prisma.InputJsonValue; peaks: Prisma.InputJsonValue; showQr: boolean; qrStyle: string; listenUrl: string | null };
  const owner = await getOwner();
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      ownerKeyHash: owner.deviceKeyHash,
      designId: spec.designId,
      colorwayId: spec.colorwayId,
      fields: spec.fields,
      peaks: spec.peaks,
      options: { showQr: spec.showQr, qrStyle: spec.qrStyle, qrTarget: spec.listenUrl ? "link" : "recording", listenUrl: spec.listenUrl },
      audioAssetId: item.audioAsset.id,
      rightsConfirmedAt: item.rightsConfirmedAt ?? new Date(),
    },
  });
  await addItem(owner, { projectId: project.id, variantId: item.variant.active ? item.variantId : item.variantId, frameFinish: item.frameFinish, quantity: 1 });
  return NextResponse.json({ ok: true, cartUrl: "/cart?added=1" });
});
