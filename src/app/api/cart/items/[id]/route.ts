import { NextResponse } from "next/server";
import { getOwner } from "@/lib/server/auth";
import { cartDto, getCart, priceCart, removeItem, updateItem, UpdateItemInput } from "@/lib/server/cart";
import { assertSameOrigin, clientIp, parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

async function respond() {
  const cart = await getCart(await getOwner(false), false);
  return NextResponse.json({ cart: cart ? cartDto(await priceCart(cart)) : null });
}

export const PATCH = route(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  await rateLimit("cart", clientIp(req));
  await updateItem(await getOwner(false), (await ctx.params).id, await parseJson(req, UpdateItemInput));
  return respond();
});

export const DELETE = route(async (req, ctx: Ctx) => {
  assertSameOrigin(req);
  await removeItem(await getOwner(false), (await ctx.params).id);
  return respond();
});
