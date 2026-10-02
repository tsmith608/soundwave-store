import { getEnv } from "../env";
import { randomToken } from "../crypto";
import type { ObjectStorage } from "./types";

export type { ObjectStorage, PresignedUpload, ObjectInfo } from "./types";

let instance: ObjectStorage | null = null;

export async function storage(): Promise<ObjectStorage> {
  if (instance) return instance;
  if (getEnv().STORAGE_DRIVER === "s3") {
    const { S3Storage } = await import("./s3");
    instance = new S3Storage();
  } else {
    const { LocalStorage } = await import("./local");
    instance = new LocalStorage();
  }
  return instance;
}

/**
 * Object key layout. Prefixes let bucket lifecycle rules and clean-up jobs
 * target each class separately:
 *   uploads/   customer recordings (private, retention-managed)
 *   renders/   production print files + previews for paid orders (keep)
 */
export function newUploadKey(ext: string): string {
  const d = new Date();
  return `uploads/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomToken(18)}.${ext}`;
}

export function renderKey(orderNumber: string, itemId: string, kind: "print-pdf" | "print-png" | "preview" | "digital-pdf" | "digital-png", ext: string): string {
  return `renders/${orderNumber}/${itemId}-${kind}-${randomToken(6)}.${ext}`;
}
