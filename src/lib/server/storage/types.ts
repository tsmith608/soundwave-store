export interface PresignedUpload {
  url: string;
  method: "PUT";
  /** Headers the browser must send exactly (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: string;
}

export interface ObjectInfo {
  size: number;
  contentType: string | null;
}

/**
 * Private object storage. Keys are opaque, random and never shown in public
 * pages; access is only through short-lived signed URLs.
 */
export interface ObjectStorage {
  readonly driver: "local" | "s3";
  presignPut(key: string, opts: { contentType: string; contentLength: number; expiresIn?: number }): Promise<PresignedUpload>;
  presignGet(key: string, opts?: { expiresIn?: number; downloadName?: string }): Promise<string>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getRange(key: string, start: number, endInclusive: number): Promise<Buffer>;
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
}

const KEY = /^[a-z0-9][a-z0-9/_.-]{2,200}$/i;
export function assertKey(key: string): string {
  if (!KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
  return key;
}
