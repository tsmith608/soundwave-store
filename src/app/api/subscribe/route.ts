import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** Stores an email for launch news / shipping-cutoff reminders. Idempotent. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  const source = typeof body?.source === "string" ? body.source.slice(0, 60) : null;
  const occasion = typeof body?.occasion === "string" ? body.occasion.slice(0, 40) : null;
  try {
    await prisma.subscriber.upsert({ where: { email }, create: { email, source, occasion }, update: {} });
  } catch (err) {
    console.error("subscribe failed", (err as Error).message);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
