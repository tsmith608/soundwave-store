import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, parseJson, route, z } from "@/lib/server/http";

const Address = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(60).optional().nullable(),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().length(2).default("US"),
  phone: z.string().trim().max(40).optional().nullable(),
  isDefault: z.boolean().default(false),
});

async function user() {
  const u = await getCurrentUser();
  if (!u) throw new AppError(401, "signin", "Please sign in.");
  return u;
}

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const u = await user();
  const a = await parseJson(req, Address);
  if ((await prisma.address.count({ where: { userId: u.id } })) >= 20) throw new AppError(400, "limit", "You can save up to 20 addresses.");
  if (a.isDefault) await prisma.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } });
  const row = await prisma.address.create({ data: { ...a, country: a.country.toUpperCase(), userId: u.id } });
  return NextResponse.json({ address: row });
});

export const DELETE = route(async (req) => {
  assertSameOrigin(req);
  const u = await user();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  await prisma.address.deleteMany({ where: { id, userId: u.id } });
  return NextResponse.json({ ok: true });
});
