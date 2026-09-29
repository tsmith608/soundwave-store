import { NextResponse, type NextRequest } from "next/server";
import { safeEqual, sha256 } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";
import { handleProdigiCallback } from "@/lib/server/fulfillment/callbacks";
import { ingestWebhook } from "@/lib/server/webhooks";

export const dynamic = "force-dynamic";

/** Prodigi → us. Authenticated by a secret token in the callback URL we register per order. */
export async function POST(req: NextRequest) {
  const secret = getEnv().PRODIGI_CALLBACK_SECRET;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!secret || !safeEqual(token, secret)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 512_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { id?: string; type?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = body.id || sha256(raw);
  const res = await ingestWebhook("prodigi", eventId, body.type || "unknown", body, handleProdigiCallback);
  return NextResponse.json(res.body, { status: res.status });
}
