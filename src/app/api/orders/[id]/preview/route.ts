import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

/**
 * Escapes XML/SVG special characters and strips invalid XML 1.0 control characters.
 * Uses .toWellFormed() to sanitize unpaired Unicode surrogates.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .toWellFormed()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Verifies that candidatePath resolves strictly within allowedDirWithSep.
 * Accounts for Windows case-insensitivity and directory boundary delimiters.
 */
function isSafePath(targetPath: string, allowedDirWithSep: string): boolean {
  const resolved = path.resolve(targetPath);
  if (process.platform === "win32") {
    return resolved.toLowerCase().startsWith(allowedDirWithSep.toLowerCase());
  }
  return resolved.startsWith(allowedDirWithSep);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Canonical preview storage directory
    const previewStorageDir = path.resolve(process.cwd(), "storage", "previews");
    const allowedDirWithSep = previewStorageDir.endsWith(path.sep)
      ? previewStorageDir
      : previewStorageDir + path.sep;

    // Collect candidate paths strictly confined within storage/previews
    const candidatePaths: string[] = [];

    // If order.previewUrl is set and is a relative path (not an external URL or web route)
    if (
      order.previewUrl &&
      !order.previewUrl.startsWith("http://") &&
      !order.previewUrl.startsWith("https://") &&
      !order.previewUrl.startsWith("/api/")
    ) {
      const resolvedPreview = path.resolve(process.cwd(), order.previewUrl);
      if (isSafePath(resolvedPreview, allowedDirWithSep)) {
        candidatePaths.push(resolvedPreview);
      }
    }

    // Standard storage conventions for this order
    if (/^[a-zA-Z0-9_-]+$/.test(order.id)) {
      candidatePaths.push(
        path.resolve(previewStorageDir, `${order.id}_preview.jpg`),
        path.resolve(previewStorageDir, `${order.id}_preview.png`),
        path.resolve(previewStorageDir, `${order.id}.png`),
        path.resolve(previewStorageDir, `${order.id}_wave.png`)
      );
    }

    for (const p of candidatePaths) {
      if (!isSafePath(p, allowedDirWithSep)) {
        continue;
      }
      try {
        const stat = await fs.stat(p);
        if (stat.isFile()) {
          // Resolve symlinks and re-verify confinement
          const realPath = await fs.realpath(p);
          if (!isSafePath(realPath, allowedDirWithSep)) {
            continue;
          }

          const fileBuffer = await fs.readFile(realPath);
          const ext = path.extname(realPath).toLowerCase();
          const contentType =
            ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
              ? "image/webp"
              : ext === ".svg"
              ? "image/svg+xml"
              : "image/png";

          return new Response(fileBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=3600, immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      } catch {
        // File does not exist or inaccessible, check next candidate
      }
    }

    // If no preview image exists on disk yet, generate a placeholder SVG
    const captionText = order.caption || "SoundWave Art Custom Print";
    const paletteName = order.palette || "SoundWave Art";

    const escapedCaption = escapeXml(captionText);
    const escapedPalette = escapeXml(paletteName);

    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
        <rect width="800" height="600" fill="#0c0c0c"/>
        <g fill="#d4af37" opacity="0.85">
          <rect x="100" y="270" width="8" height="60" rx="4"/>
          <rect x="120" y="250" width="8" height="100" rx="4"/>
          <rect x="140" y="230" width="8" height="140" rx="4"/>
          <rect x="160" y="200" width="8" height="200" rx="4"/>
          <rect x="180" y="220" width="8" height="160" rx="4"/>
          <rect x="200" y="240" width="8" height="120" rx="4"/>
          <rect x="220" y="210" width="8" height="180" rx="4"/>
          <rect x="240" y="190" width="8" height="220" rx="4"/>
          <rect x="260" y="170" width="8" height="260" rx="4"/>
          <rect x="280" y="150" width="8" height="300" rx="4"/>
          <rect x="300" y="180" width="8" height="240" rx="4"/>
          <rect x="320" y="210" width="8" height="180" rx="4"/>
          <rect x="340" y="170" width="8" height="260" rx="4"/>
          <rect x="360" y="130" width="8" height="340" rx="4"/>
          <rect x="380" y="160" width="8" height="280" rx="4"/>
          <rect x="400" y="120" width="8" height="360" rx="4"/>
          <rect x="420" y="150" width="8" height="300" rx="4"/>
          <rect x="440" y="180" width="8" height="240" rx="4"/>
          <rect x="460" y="160" width="8" height="280" rx="4"/>
          <rect x="480" y="140" width="8" height="320" rx="4"/>
          <rect x="500" y="170" width="8" height="260" rx="4"/>
          <rect x="520" y="190" width="8" height="220" rx="4"/>
          <rect x="540" y="210" width="8" height="180" rx="4"/>
          <rect x="560" y="230" width="8" height="140" rx="4"/>
          <rect x="580" y="250" width="8" height="100" rx="4"/>
          <rect x="600" y="270" width="8" height="60" rx="4"/>
        </g>
        <text x="400" y="530" fill="#d4af37" font-family="Georgia, serif" font-size="20" text-anchor="middle">${escapedCaption}</text>
        <text x="400" y="560" fill="#888888" font-family="sans-serif" font-size="12" text-anchor="middle">${escapedPalette} • Preview Generating</text>
      </svg>
    `.trim();

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error: any) {
    console.error("Preview retrieval error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
