import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { getEnv } from "../env";
import { signToken } from "../crypto";
import { assertKey, type ObjectInfo, type ObjectStorage, type PresignedUpload } from "./types";

/**
 * Filesystem driver for development (and single-server installs with a
 * persistent volume). Signed URLs point at /api/storage/local, which checks
 * the HMAC before reading or writing — same contract as S3 presigned URLs.
 */
export class LocalStorage implements ObjectStorage {
  readonly driver = "local" as const;
  readonly root = path.resolve(process.cwd(), getEnv().STORAGE_LOCAL_DIR);

  pathFor(key: string): string {
    const p = path.resolve(this.root, assertKey(key));
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }

  private metaPath(key: string) {
    return this.pathFor(key) + ".meta.json";
  }

  async presignPut(key: string, opts: { contentType: string; contentLength: number; expiresIn?: number }): Promise<PresignedUpload> {
    const ttl = opts.expiresIn ?? 900;
    const token = signToken(JSON.stringify({ k: assertKey(key), op: "put", ct: opts.contentType, len: opts.contentLength }), "storage", ttl);
    return {
      url: `${getEnv().NEXT_PUBLIC_APP_URL}/api/storage/local?t=${encodeURIComponent(token)}`,
      method: "PUT",
      headers: { "content-type": opts.contentType },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async presignGet(key: string, opts?: { expiresIn?: number; downloadName?: string }): Promise<string> {
    const token = signToken(JSON.stringify({ k: assertKey(key), op: "get", dn: opts?.downloadName }), "storage", opts?.expiresIn ?? 300);
    return `${getEnv().NEXT_PUBLIC_APP_URL}/api/storage/local?t=${encodeURIComponent(token)}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const p = this.pathFor(key);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, body);
    await fsp.writeFile(this.metaPath(key), JSON.stringify({ contentType }));
  }

  async writeStream(key: string, contentType: string, stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<number> {
    const p = this.pathFor(key);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.${Date.now()}.part`;
    const out = fs.createWriteStream(tmp);
    let total = 0;
    try {
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error("Upload larger than declared size");
        if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
      }
      await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
      await fsp.rename(tmp, p);
      await fsp.writeFile(this.metaPath(key), JSON.stringify({ contentType }));
      return total;
    } catch (e) {
      out.destroy();
      await fsp.rm(tmp, { force: true });
      throw e;
    }
  }

  async get(key: string): Promise<Buffer> {
    return fsp.readFile(this.pathFor(key));
  }

  async getRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
    const fh = await fsp.open(this.pathFor(key), "r");
    try {
      const len = Math.max(0, endInclusive - start + 1);
      const buf = Buffer.alloc(len);
      const { bytesRead } = await fh.read(buf, 0, len, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const st = await fsp.stat(this.pathFor(key));
      let contentType: string | null = null;
      try {
        contentType = JSON.parse(await fsp.readFile(this.metaPath(key), "utf8")).contentType ?? null;
      } catch {}
      return { size: st.size, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await fsp.rm(this.pathFor(key), { force: true });
    await fsp.rm(this.metaPath(key), { force: true });
  }
}
