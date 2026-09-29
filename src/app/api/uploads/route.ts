import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { createUploadIntent } from "@/lib/server/media";
import { rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({
  fileName: z.string().max(300).optional(),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
  durationMs: z.number().int().positive().optional(),
  source: z.enum(["audio", "video", "recording"]).default("audio"),
});

/** Step 1 of an upload: returns a short-lived signed URL to PUT the sound to. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("upload", clientIp(req));
  const body = await parseJson(req, Body);
  const owner = await getOwner();
  const res = await createUploadIntent(owner, body);
  return NextResponse.json(res, { headers: { "cache-control": "no-store" } });
});
