import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { cartDto, getCart, priceCart, touch } from "@/lib/server/cart";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

const EMPTY = { id: null, items: [], quote: null, email: null, recoveryConsent: false, discountCode: null };

export const GET = route(async () => {
  const cart = await getCart(await getOwner(false), false);
  if (!cart) return NextResponse.json({ cart: EMPTY }, { headers: { "cache-control": "no-store" } });
  return NextResponse.json({ cart: cartDto(await priceCart(cart)) }, { headers: { "cache-control": "no-store" } });
});

const Patch = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254).nullable().optional(),
  recoveryConsent: z.boolean().optional(),
  attribution: z.record(z.string(), z.string().max(300)).optional(),
});

/** Email (for the receipt / optional reminder), reminder consent and first-touch attribution. */
export const PATCH = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("cart", clientIp(req));
  const body = await parseJson(req, Patch);
  const cart = await getCart(await getOwner(), true);
  await touch(cart!.id, {
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.recoveryConsent !== undefined ? { recoveryConsent: body.recoveryConsent } : {}),
    // First touch wins: attribution is only recorded once per cart.
    ...(body.attribution && !cart!.attribution ? { attribution: body.attribution } : {}),
  });
  const fresh = await getCart(await getOwner(false), false);
  return NextResponse.json({ cart: cartDto(await priceCart(fresh!)) });
});
