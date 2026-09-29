import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { cartDto, getCart, priceCart, setDiscountCode } from "@/lib/server/cart";
import { assertSameOrigin, clientIp, parseJson, route, z } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({ code: z.string().trim().min(1, "Enter a code.").max(40) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("discount", clientIp(req)); // stops code guessing
  const { code } = await parseJson(req, Body);
  const owner = await getOwner();
  await setDiscountCode(owner, code);
  const cart = await getCart(owner, false);
  return NextResponse.json({ cart: cartDto(await priceCart(cart!)) });
});

export const DELETE = route(async (req) => {
  assertSameOrigin(req);
  const owner = await getOwner();
  await setDiscountCode(owner, null);
  const cart = await getCart(owner, false);
  return NextResponse.json({ cart: cart ? cartDto(await priceCart(cart)) : null });
});
