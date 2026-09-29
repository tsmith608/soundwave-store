import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "../env";
import { assertKey, type ObjectInfo, type ObjectStorage, type PresignedUpload } from "./types";

/**
 * S3-compatible driver: AWS S3, Cloudflare R2 (S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com,
 * S3_REGION=auto) or Supabase Storage's S3 endpoint. The bucket must be PRIVATE;
 * every read and write goes through a presigned URL.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = "s3" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const e = getEnv();
    this.bucket = e.S3_BUCKET!;
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
      maxAttempts: 3,
    });
  }

  async presignPut(key: string, opts: { contentType: string; contentLength: number; expiresIn?: number }): Promise<PresignedUpload> {
    const ttl = opts.expiresIn ?? 900;
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: assertKey(key), ContentType: opts.contentType, ContentLength: opts.contentLength });
    // content-type and content-length are signed: the upload must match what we validated.
    const url = await getSignedUrl(this.client, cmd, { expiresIn: ttl, signableHeaders: new Set(["content-type", "content-length"]) });
    return { url, method: "PUT", headers: { "content-type": opts.contentType }, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }

  async presignGet(key: string, opts?: { expiresIn?: number; downloadName?: string }): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: assertKey(key),
      ResponseContentDisposition: opts?.downloadName ? `attachment; filename="${opts.downloadName.replace(/[^\w.-]/g, "_")}"` : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: Math.min(opts?.expiresIn ?? 300, 7 * 24 * 3600) });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: assertKey(key), Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: assertKey(key) }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async getRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: assertKey(key), Range: `bytes=${start}-${endInclusive}` }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: assertKey(key) }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
    } catch (e: unknown) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (e as Error).name === "NotFound") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: assertKey(key) }));
  }
}
