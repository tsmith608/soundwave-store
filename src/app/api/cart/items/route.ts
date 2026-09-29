import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { addItem, AddItemInput, cartDto, priceCart } from "@/lib/server/cart";
import { assertSameOrigin, clientIp, parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await rateLimit("cart", clientIp(req));
  const input = await parseJson(req, AddItemInput);
  const cart = await addItem(await getOwner(), input);
  return NextResponse.json({ cart: cartDto(await priceCart(cart)) });
});
