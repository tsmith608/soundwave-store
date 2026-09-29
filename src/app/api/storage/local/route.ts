import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { verifyToken } from "@/lib/server/crypto";
import { storage } from "@/lib/server/storage";
import type { LocalStorage } from "@/lib/server/storage/local";

/**
 * Signed-URL endpoint for the local storage driver (development, or a single
 * server with a persistent volume). Mirrors S3 presigned PUT/GET semantics.
 */
export const dynamic = "force-dynamic";

async function localDriver(): Promise<LocalStorage | null> {
  if (getEnv().STORAGE_DRIVER !== "local") return null;
  return (await storage()) as LocalStorage;
}

function claims(req: NextRequest, op: "put" | "get") {
  const t = req.nextUrl.searchParams.get("t");
  const raw = t ? verifyToken(t, "storage") : null;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as { k: string; op: string; ct?: string; len?: number; dn?: string };
    return c.op === op ? c : null;
  } catch {
    return null;
  }
}

export async function PUT(req: NextRequest) {
  const s = await localDriver();
  const c = claims(req, "put");
  if (!s || !c || !req.body) return NextResponse.json({ error: "Invalid or expired upload link" }, { status: 403 });
  if ((req.headers.get("content-type") || "").split(";")[0] !== c.ct) return NextResponse.json({ error: "Content type mismatch" }, { status: 400 });
  try {
    const n = await s.writeStream(c.k, c.ct!, req.body, c.len!);
    if (n !== c.len) {
      await s.delete(c.k);
      return NextResponse.json({ error: "Size mismatch" }, { status: 400 });
    }
    return new NextResponse(null, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const s = await localDriver();
  const c = claims(req, "get");
  if (!s || !c) return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  const info = await s.head(c.k);
  if (!info) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const range = req.headers.get("range");
  const headers: Record<string, string> = {
    "content-type": info.contentType || "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
    ...(c.dn ? { "content-disposition": `attachment; filename="${c.dn.replace(/[^\w.-]/g, "_")}"` } : {}),
  };
  const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    const buf = await s.getRange(c.k, start, end);
    return new NextResponse(new Uint8Array(buf), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": String(buf.length) } });
  }
  const buf = await s.get(c.k);
  return new NextResponse(new Uint8Array(buf), { headers: { ...headers, "content-length": String(buf.length) } });
}
