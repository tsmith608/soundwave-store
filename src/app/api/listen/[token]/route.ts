import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const MIME: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4" };

/** Streams the recording behind a printed scan-to-listen code. Supports range requests for iOS Safari. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return new NextResponse(null, { status: 404 });
  const order = await prisma.order.findUnique({ where: { listenToken: token }, select: { audioPath: true, status: true } }).catch(() => null);
  if (!order || order.status === "cancelled") return new NextResponse(null, { status: 404 });
  const storage = path.resolve(process.cwd(), "storage") + path.sep;
  const file = path.resolve(process.cwd(), order.audioPath);
  if (!file.startsWith(storage) || !fs.existsSync(file)) return new NextResponse(null, { status: 404 });

  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
    const buf = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(file, "r");
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return new NextResponse(buf, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": String(buf.length) } });
  }
  return new NextResponse(fs.readFileSync(file), { headers: { ...headers, "content-length": String(stat.size) } });
}
