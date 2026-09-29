import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { AppError, assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { orderUrl } from "@/lib/server/orders/access";
import { rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({
  number: z.string().trim().min(3).max(30),
  email: z.string().trim().toLowerCase().email("Please enter the email you ordered with.").max(254),
});

/** Guest order tracking: order number + email (rate-limited against guessing). */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("track", clientIp(req));
  const { number, email } = await parseJson(req, Body);
  const o = await prisma.order.findUnique({ where: { number: number.toUpperCase().replace(/\s+/g, "") } });
  if (!o || !o.paidAt || o.email.toLowerCase() !== email) throw new AppError(404, "not_found", "We couldn't find an order with that number and email. Check your confirmation email, or contact us.");
  return NextResponse.json({ url: orderUrl(o.id) });
});
