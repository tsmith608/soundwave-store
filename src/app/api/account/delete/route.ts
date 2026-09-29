import { NextResponse } from "next/server";
import { endSession, getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, parseJson, route, z } from "@/lib/server/http";
import { deleteAssetBytes } from "@/lib/server/media";

/**
 * Deletes the account: sessions, addresses, draft designs and their unused
 * recordings. Paid orders are kept (tax/accounting records) but unlinked, and
 * the recordings behind printed QR codes keep playing unless the customer
 * also asks us to remove them.
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "signin", "Please sign in.");
  const { confirm } = await parseJson(req, z.object({ confirm: z.literal("DELETE") }));
  void confirm;
  const drafts = await prisma.project.findMany({ where: { userId: user.id, status: "draft" }, select: { id: true, audioAssetId: true } });
  await prisma.project.deleteMany({ where: { id: { in: drafts.map((d) => d.id) } } });
  for (const d of drafts) {
    if (!d.audioAssetId) continue;
    const used = (await prisma.orderItem.count({ where: { audioAssetId: d.audioAssetId } })) + (await prisma.project.count({ where: { audioAssetId: d.audioAssetId } }));
    if (!used) await deleteAssetBytes(d.audioAssetId, "account_deleted");
  }
  await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.order.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.project.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.cart.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { email: `deleted-${user.id}@deleted.invalid`, name: null, deletedAt: new Date(), marketingOptIn: false } }),
    prisma.auditEvent.create({ data: { actor: "customer", action: "account_deleted", targetType: "user", targetId: user.id } }),
  ]);
  await endSession();
  return NextResponse.json({ ok: true });
});
