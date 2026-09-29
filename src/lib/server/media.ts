import { prisma } from "./db";
import { AppError } from "./http";
import { log } from "./log";
import { newUploadKey, storage } from "./storage";
import type { Owner } from "./auth";

/**
 * Customer recordings. The browser extracts the sound from videos, so only
 * audio ever arrives here. Uploads go straight to object storage through a
 * presigned URL; this module issues the URL and then verifies what landed.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // client re-encodes anything > 10 MB to ~8 MB WAV
export const MAX_DURATION_MS = 3 * 60 * 1000 + 5000;
/** Unattached uploads are deleted after this (see src/lib/retention.ts). */
export const UNATTACHED_TTL_MS = 30 * 24 * 3600 * 1000;
/** Upload intents whose bytes never arrived are cleaned up after this. */
export const PENDING_TTL_MS = 24 * 3600 * 1000;

export const AUDIO_TYPES: Record<string, { ext: string; kinds: SniffKind[] }> = {
  "audio/wav": { ext: "wav", kinds: ["wav"] },
  "audio/x-wav": { ext: "wav", kinds: ["wav"] },
  "audio/wave": { ext: "wav", kinds: ["wav"] },
  "audio/mpeg": { ext: "mp3", kinds: ["mp3"] },
  "audio/mp3": { ext: "mp3", kinds: ["mp3"] },
  "audio/mp4": { ext: "m4a", kinds: ["mp4"] },
  "audio/x-m4a": { ext: "m4a", kinds: ["mp4"] },
  "audio/m4a": { ext: "m4a", kinds: ["mp4"] },
  "audio/aac": { ext: "aac", kinds: ["aac", "mp4"] },
  "audio/webm": { ext: "webm", kinds: ["webm"] },
  "audio/ogg": { ext: "ogg", kinds: ["ogg"] },
  "audio/flac": { ext: "flac", kinds: ["flac"] },
};

export type SniffKind = "wav" | "mp3" | "mp4" | "aac" | "webm" | "ogg" | "flac";

/** Identifies an audio container from its first bytes. */
export function sniffAudio(b: Buffer): SniffKind | null {
  if (b.length < 12) return null;
  const s = (a: number, n: number) => b.subarray(a, a + n).toString("latin1");
  if (s(0, 4) === "RIFF" && s(8, 4) === "WAVE") return "wav";
  if (s(4, 4) === "ftyp") return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (s(0, 4) === "OggS") return "ogg";
  if (s(0, 4) === "fLaC") return "flac";
  if (s(0, 3) === "ID3") return "mp3";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "aac"; // ADTS
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3"; // MPEG frame sync
  return null;
}

export function normaliseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function safeFileName(name: string | undefined): string | null {
  if (!name) return null;
  return name.replace(/[^\w .()-]/g, "_").slice(0, 120) || null;
}

export async function createUploadIntent(owner: Owner, input: { fileName?: string; mimeType: string; sizeBytes: number; durationMs?: number; source: "audio" | "video" | "recording" }) {
  const mime = normaliseMime(input.mimeType);
  const type = AUDIO_TYPES[mime];
  if (!type) throw new AppError(415, "unsupported_type", "That audio format isn't supported. Try M4A, MP3 or WAV.");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1000) throw new AppError(400, "too_small", "That recording is empty or too short.");
  if (input.sizeBytes > MAX_UPLOAD_BYTES) throw new AppError(413, "too_large", "That recording is too large. Please trim it to under 3 minutes.");
  if (input.durationMs && input.durationMs > MAX_DURATION_MS) throw new AppError(400, "too_long", "Please trim the recording to under 3 minutes.");

  const key = newUploadKey(type.ext);
  const asset = await prisma.uploadedAsset.create({
    data: {
      ownerKeyHash: owner.deviceKeyHash,
      userId: owner.userId,
      source: input.source,
      storageKey: key,
      mimeType: mime,
      sizeBytes: input.sizeBytes,
      durationMs: input.durationMs ?? null,
      originalName: safeFileName(input.fileName),
      status: "pending",
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  const upload = await (await storage()).presignPut(key, { contentType: mime, contentLength: input.sizeBytes, expiresIn: 900 });
  return { assetId: asset.id, upload };
}

export async function completeUpload(owner: Owner, assetId: string) {
  const asset = await prisma.uploadedAsset.findUnique({ where: { id: assetId } });
  if (!asset || !(asset.ownerKeyHash && asset.ownerKeyHash === owner.deviceKeyHash) && !(asset.userId && asset.userId === owner.userId)) {
    throw new AppError(404, "not_found", "We couldn't find that upload. Please upload it again.");
  }
  if (asset.status === "ready") return asset;
  if (asset.status !== "pending") throw new AppError(409, "not_pending", "That upload can't be used. Please upload it again.");

  const s = await storage();
  const head = await s.head(asset.storageKey);
  if (!head) throw new AppError(409, "not_uploaded", "The upload didn't finish. Please try again.");

  let reason: string | null = null;
  if (head.size !== asset.sizeBytes) reason = `size mismatch (${head.size} != ${asset.sizeBytes})`;
  else {
    const first = await s.getRange(asset.storageKey, 0, 63);
    const kind = sniffAudio(first);
    if (!kind || !AUDIO_TYPES[asset.mimeType]?.kinds.includes(kind)) reason = `content does not match ${asset.mimeType} (${kind ?? "unknown"})`;
  }

  if (reason) {
    await s.delete(asset.storageKey).catch(() => undefined);
    await prisma.uploadedAsset.update({ where: { id: asset.id }, data: { status: "rejected", rejectReason: reason, deletedAt: new Date(), deleteReason: "failed_validation" } });
    log.warn("upload_rejected", { assetId: asset.id, reason });
    throw new AppError(422, "invalid_audio", "That file doesn't look like a valid recording. Please try another file.");
  }

  return prisma.uploadedAsset.update({
    where: { id: asset.id },
    data: { status: "ready", verifiedAt: new Date(), expiresAt: new Date(Date.now() + UNATTACHED_TTL_MS) },
  });
}

/** Permanently removes an asset's bytes (retention, takedown or customer request). */
export async function deleteAssetBytes(assetId: string, reason: string) {
  const asset = await prisma.uploadedAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.status === "deleted") return false;
  await (await storage()).delete(asset.storageKey).catch((err) => log.warn("storage_delete_failed", { assetId, err }));
  await prisma.uploadedAsset.update({ where: { id: assetId }, data: { status: "deleted", deletedAt: new Date(), deleteReason: reason, expiresAt: null } });
  return true;
}
