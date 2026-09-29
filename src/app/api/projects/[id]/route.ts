import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, clientIp, parseJson, route } from "@/lib/server/http";
import { deleteAssetBytes } from "@/lib/server/media";
import { loadOwnedProject, ProjectInput, projectDto, saveProject } from "@/lib/server/projects";
import { rateLimit } from "@/lib/server/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const project = await loadOwnedProject(await getOwner(false), (await ctx.params).id);
  const asset = project.audioAssetId ? await prisma.uploadedAsset.findUnique({ where: { id: project.audioAssetId } }) : null;
  return NextResponse.json({
    project: projectDto(project),
    audio: asset && asset.status === "ready" ? { id: asset.id, source: asset.source, fileName: asset.originalName, durationMs: asset.durationMs } : null,
  });
});

export const PUT = route(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  await rateLimit("project", clientIp(req));
  const input = await parseJson(req, ProjectInput);
  const project = await saveProject(await getOwner(), input, (await ctx.params).id);
  return NextResponse.json({ project: projectDto(project) });
});

/** Deletes a draft project and its recording (if no order uses it). */
export const DELETE = route(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  const owner = await getOwner(false);
  const project = await loadOwnedProject(owner, (await ctx.params).id);
  if (project.status === "ordered") throw new AppError(409, "ordered", "This design belongs to an order and can't be deleted here. Email us if you'd like it removed.");
  await prisma.project.delete({ where: { id: project.id } });
  if (project.audioAssetId) {
    const inUse = (await prisma.project.count({ where: { audioAssetId: project.audioAssetId } })) + (await prisma.orderItem.count({ where: { audioAssetId: project.audioAssetId } }));
    if (!inUse) await deleteAssetBytes(project.audioAssetId, "project_deleted");
  }
  return NextResponse.json({ deleted: true });
});
