import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { assertSameOrigin, route } from "@/lib/server/http";
import { completeUpload } from "@/lib/server/media";

/** Step 2 of an upload: verifies the stored bytes (size + real file type). */
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const asset = await completeUpload(await getOwner(), id);
  return NextResponse.json({ assetId: asset.id, status: asset.status, sizeBytes: asset.sizeBytes, durationMs: asset.durationMs });
});
