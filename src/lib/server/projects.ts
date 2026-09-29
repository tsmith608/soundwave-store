import type { Prisma, Project } from "@prisma/client";
import { z } from "zod";
import { cleanFields, getSellableDesign, sanitizePeaks, type ArtFields } from "@/lib/art";
import { cleanListenUrl } from "@/lib/listenLink";
import { prisma } from "./db";
import { AppError } from "./http";
import { ownsRecord, type Owner } from "./auth";

export const ProjectInput = z.object({
  designId: z.string().max(60),
  colorwayId: z.string().max(60).optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  options: z
    .object({
      showQr: z.boolean().default(true),
      qrStyle: z.enum(["discreet", "standard"]).default("discreet"),
      qrTarget: z.enum(["recording", "link"]).default("recording"),
      listenUrl: z.string().max(600).nullable().optional(),
    })
    .default({ showQr: true, qrStyle: "discreet", qrTarget: "recording" }),
  peaks: z.array(z.number()).max(2000).nullable().optional(),
  audioAssetId: z.string().max(40).nullable().optional(),
  rightsConfirmed: z.boolean().default(false),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export interface ProjectOptions {
  showQr: boolean;
  qrStyle: "discreet" | "standard";
  qrTarget: "recording" | "link";
  listenUrl: string | null;
}

/** Validates and normalises studio input into what we store. */
export async function normaliseProject(owner: Owner, input: ProjectInput) {
  const design = getSellableDesign(input.designId);
  if (!design) throw new AppError(400, "unknown_design", "That design isn't available.");
  const template = await prisma.designTemplate.findUnique({ where: { id: design.id } });
  if (template && !template.active) throw new AppError(400, "design_inactive", "That design isn't available right now.");
  const colorway = design.colorways.find((c) => c.id === input.colorwayId) ?? design.colorways[0];
  const fields: ArtFields = cleanFields(design, input.fields as Partial<Record<keyof ArtFields, unknown>>);
  const listenUrl = input.options.qrTarget === "link" ? cleanListenUrl(input.options.listenUrl) : null;
  if (input.options.showQr && input.options.qrTarget === "link" && input.options.listenUrl && !listenUrl) {
    throw new AppError(400, "bad_link", "That listen link doesn't look like a web address. Paste a full link, e.g. https://open.spotify.com/…");
  }
  const options: ProjectOptions = { showQr: input.options.showQr, qrStyle: input.options.qrStyle, qrTarget: listenUrl ? "link" : "recording", listenUrl };
  const peaks = input.peaks ? sanitizePeaks(input.peaks) : null;

  let audioAssetId: string | null = null;
  if (input.audioAssetId) {
    const asset = await prisma.uploadedAsset.findUnique({ where: { id: input.audioAssetId } });
    if (!asset || !ownsRecord(owner, asset) || asset.status !== "ready") throw new AppError(400, "bad_asset", "Your recording has expired or was removed. Please add it again.");
    audioAssetId = asset.id;
  }
  return {
    designId: design.id,
    colorwayId: colorway.id,
    fields: fields as unknown as Prisma.InputJsonValue,
    options: options as unknown as Prisma.InputJsonValue,
    peaks: peaks ? (peaks.map((p) => Math.round(p * 1000) / 1000) as Prisma.InputJsonValue) : undefined,
    audioAssetId,
    rightsConfirmedAt: input.rightsConfirmed ? new Date() : null,
  };
}

export async function loadOwnedProject(owner: Owner, id: string): Promise<Project> {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p || !ownsRecord(owner, p)) throw new AppError(404, "not_found", "We couldn't find that design. It may have been saved on another device.");
  return p;
}

export async function saveProject(owner: Owner, input: ProjectInput, id?: string): Promise<Project> {
  const data = await normaliseProject(owner, input);
  if (id) {
    const existing = await loadOwnedProject(owner, id);
    if (existing.status === "ordered") {
      // Purchased designs are immutable: editing one starts a new project.
      return prisma.project.create({ data: { ...data, userId: owner.userId, ownerKeyHash: owner.deviceKeyHash } });
    }
    return prisma.project.update({
      where: { id },
      data: { ...data, rightsConfirmedAt: data.rightsConfirmedAt ?? existing.rightsConfirmedAt, userId: existing.userId ?? owner.userId },
    });
  }
  return prisma.project.create({ data: { ...data, userId: owner.userId, ownerKeyHash: owner.deviceKeyHash } });
}

export function projectDto(p: Project) {
  return {
    id: p.id,
    status: p.status,
    designId: p.designId,
    colorwayId: p.colorwayId,
    fields: p.fields,
    options: p.options,
    peaks: p.peaks,
    audioAssetId: p.audioAssetId,
    rightsConfirmed: Boolean(p.rightsConfirmedAt),
    updatedAt: p.updatedAt.toISOString(),
  };
}
