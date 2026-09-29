import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { handleResendEvent } from "@/lib/server/email/events";
import { ingestWebhook } from "@/lib/server/webhooks";
import { verifySvixSignature } from "@/lib/svix";

export const dynamic = "force-dynamic";

/** Resend → us (delivery / bounce / complaint). Svix-signed. */
export async function POST(req: NextRequest) {
  const secret = getEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 404 });
  const raw = await req.text();
  const v = verifySvixSignature(raw, req.headers, secret);
  if (!v.valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  let body: { type?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = req.headers.get("svix-id") || "";
  const res = await ingestWebhook("resend", id, body.type || "unknown", body, handleResendEvent);
  return NextResponse.json(res.body, { status: res.status });
}
