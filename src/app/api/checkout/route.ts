import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { startCheckout } from "@/lib/server/orders/checkout";
import { rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254).nullable().optional() });

/** Creates the order from the server-side cart and returns the payment page URL. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("checkout", clientIp(req));
  const body = await parseJson(req, Body);
  const res = await startCheckout(await getOwner(), { email: body.email });
  return NextResponse.json(res, { headers: { "cache-control": "no-store" } });
});
