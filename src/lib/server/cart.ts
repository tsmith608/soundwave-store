import { cookies } from "next/headers";
import type { Cart, CartItem, Discount, Prisma, Project, ProductVariant } from "@prisma/client";
import { z } from "zod";
import { getSellableDesign, type ArtFields } from "@/lib/art";
import { discountAvailability, MAX_QTY_PER_LINE, normaliseCode, quote, type DiscountRule, type Quote } from "@/lib/commerce";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { AppError } from "./http";
import { cookieOptions, CART_COOKIE } from "./identity";
import { ownsRecord, type Owner } from "./auth";
import { availableShipping, variantDto } from "./catalog";
import type { ProjectOptions } from "./projects";

export type CartWithItems = Cart & { items: (CartItem & { project: Project; variant: ProductVariant })[] };

const include = { items: { include: { project: true, variant: true }, orderBy: { createdAt: "asc" } } } satisfies Prisma.CartInclude;

function hashToken(t: string) {
  return sha256(`cart:${t}`);
}

/** The visitor's current cart, optionally creating one. Converted carts are replaced by a fresh one. */
export async function getCart(owner: Owner, create: boolean): Promise<CartWithItems | null> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  let cart: CartWithItems | null = null;
  if (token && token.length >= 20) {
    cart = await prisma.cart.findUnique({ where: { tokenHash: hashToken(token) }, include });
    if (cart && (cart.status === "converted" || cart.status === "abandoned")) cart = null;
  }
  if (!cart && owner.userId) {
    // Signed-in customers get their most recent open cart on any device.
    const recent = await prisma.cart.findFirst({ where: { userId: owner.userId, status: { in: ["active", "checking_out"] } }, orderBy: { updatedAt: "desc" }, include });
    if (recent) {
      const t = randomToken(24);
      cart = await prisma.cart.update({ where: { id: recent.id }, data: { tokenHash: hashToken(t) }, include });
      jar.set(CART_COOKIE, t, cookieOptions(60));
    }
  }
  if (!cart && create) {
    const t = randomToken(24);
    cart = await prisma.cart.create({ data: { tokenHash: hashToken(t), userId: owner.userId }, include });
    jar.set(CART_COOKIE, t, cookieOptions(60));
  }
  if (cart && owner.userId && !cart.userId) cart = await prisma.cart.update({ where: { id: cart.id }, data: { userId: owner.userId }, include });
  return cart;
}

/** Read-only cart lookup for server components (never sets cookies). */
export async function readCart(): Promise<CartWithItems | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const cart = await prisma.cart.findUnique({ where: { tokenHash: hashToken(token) }, include });
  return cart && (cart.status === "active" || cart.status === "checking_out") ? cart : null;
}

/** Which studio fields are still missing for this project to be printable. */
export function projectProblems(p: Project): string[] {
  const out: string[] = [];
  const design = getSellableDesign(p.designId);
  if (!design) return ["This design is no longer available."];
  const fields = p.fields as unknown as ArtFields;
  const missing = design.fields.filter((f) => f.required && !String(fields?.[f.key] ?? "").trim());
  if (missing.length) out.push(`Add ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`);
  if (!p.audioAssetId || !Array.isArray(p.peaks)) out.push("Add your recording.");
  if (!p.rightsConfirmedAt) out.push("Confirm you made the recording or have permission to use it.");
  const o = p.options as unknown as ProjectOptions;
  if (o?.showQr && o.qrTarget === "link" && !o.listenUrl) out.push("Add a valid listen link, or let the code play your recording.");
  return out;
}

async function loadDiscount(code: string | null | undefined): Promise<Discount | null> {
  if (!code) return null;
  return prisma.discount.findUnique({ where: { code: normaliseCode(code) } });
}

export function toRule(d: Discount): DiscountRule {
  return { code: d.code, type: d.type, value: d.value, minSubtotalCents: d.minSubtotalCents, variantIds: d.variantIds };
}

export interface PricedCart {
  cart: CartWithItems;
  quote: Quote;
  discountRecord: Discount | null;
  problems: Record<string, string[]>;
}

/** Recomputes prices from the database. Invalid discounts are reported, not silently applied. */
export async function priceCart(cart: CartWithItems, opts: { email?: string | null; shippingId?: string } = {}): Promise<PricedCart> {
  const shippingOptions = availableShipping(cart.items.map((i) => variantDto(i.variant)));
  const shipping = shippingOptions.find((s) => s.id === opts.shippingId) ?? shippingOptions[0];
  let discountRecord = await loadDiscount(cart.discountCode);
  let discountMsg: string | null = null;
  if (discountRecord) {
    const email = opts.email ?? cart.email;
    const used = email && discountRecord.maxPerCustomer != null ? await prisma.discountRedemption.count({ where: { discountId: discountRecord.id, email: email.toLowerCase() } }) : undefined;
    const avail = discountAvailability(discountRecord, new Date(), used);
    if (!avail.ok) {
      discountMsg = avail.reason;
      discountRecord = null;
    }
  } else if (cart.discountCode) discountMsg = "That code isn't valid.";

  const lines = cart.items.map((i) => ({
    key: i.id,
    variantId: i.variantId,
    label: i.variant.label,
    unitPriceCents: i.variant.priceCents,
    quantity: Math.min(i.quantity, MAX_QTY_PER_LINE),
  }));
  const q = quote({ lines, discount: discountRecord ? toRule(discountRecord) : null, shipping });
  if (discountMsg) q.discountMessage = discountMsg;

  const problems: Record<string, string[]> = {};
  for (const i of cart.items) {
    const p = projectProblems(i.project);
    if (!i.variant.active) p.push("This size is no longer available — please choose another.");
    if (i.variant.format === "framed" && (!i.frameFinish || !i.variant.frameFinishes.includes(i.frameFinish))) p.push("Choose a frame colour.");
    if (p.length) problems[i.id] = p;
  }
  return { cart, quote: q, discountRecord, problems };
}

export const AddItemInput = z.object({
  projectId: z.string().max(40),
  variantId: z.string().max(40),
  frameFinish: z.string().max(20).nullable().optional(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
});

async function checkVariant(variantId: string, frameFinish: string | null | undefined) {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!v || !v.active) throw new AppError(400, "bad_variant", "That size isn't available.");
  let finish: string | null = null;
  if (v.format === "framed") {
    finish = frameFinish && v.frameFinishes.includes(frameFinish) ? frameFinish : v.frameFinishes[0] ?? null;
  }
  return { v, finish };
}

export async function addItem(owner: Owner, input: z.infer<typeof AddItemInput>) {
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project || !ownsRecord(owner, project)) throw new AppError(404, "not_found", "We couldn't find that design. Please save it again.");
  const problems = projectProblems(project);
  if (problems.length) throw new AppError(400, "incomplete", problems.join(" "));
  const { v, finish } = await checkVariant(input.variantId, input.frameFinish);
  const cart = (await getCart(owner, true))!;
  const count = cart.items.reduce((a, i) => a + i.quantity, 0);
  if (count + input.quantity > 20) throw new AppError(400, "cart_full", "Carts are limited to 20 pieces. Please place a separate order for more.");
  // Same design + same product → bump quantity instead of duplicating the line.
  const same = cart.items.find((i) => i.projectId === project.id && i.variantId === v.id && (i.frameFinish ?? null) === finish);
  if (same) {
    await prisma.cartItem.update({ where: { id: same.id }, data: { quantity: Math.min(MAX_QTY_PER_LINE, same.quantity + input.quantity) } });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, projectId: project.id, variantId: v.id, frameFinish: finish, quantity: input.quantity } });
  }
  await touch(cart.id, { status: "active" });
  return (await getCart(owner, false))!;
}

export const UpdateItemInput = z.object({
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE).optional(),
  variantId: z.string().max(40).optional(),
  frameFinish: z.string().max(20).nullable().optional(),
});

async function ownedItem(owner: Owner, itemId: string) {
  const cart = await getCart(owner, false);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new AppError(404, "not_found", "That item is no longer in your cart.");
  return { cart, item };
}

export async function updateItem(owner: Owner, itemId: string, input: z.infer<typeof UpdateItemInput>) {
  const { cart, item } = await ownedItem(owner, itemId);
  const data: Prisma.CartItemUpdateInput = {};
  if (input.quantity) data.quantity = input.quantity;
  if (input.variantId || input.frameFinish !== undefined) {
    const { v, finish } = await checkVariant(input.variantId ?? item.variantId, input.frameFinish ?? item.frameFinish);
    data.variant = { connect: { id: v.id } };
    data.frameFinish = finish;
  }
  await prisma.cartItem.update({ where: { id: item.id }, data });
  await touch(cart.id, { status: "active" });
}

export async function removeItem(owner: Owner, itemId: string) {
  const { cart, item } = await ownedItem(owner, itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
  await touch(cart.id, { status: "active" });
}

export async function setDiscountCode(owner: Owner, code: string | null) {
  const cart = await getCart(owner, true);
  if (!cart) throw new AppError(404, "no_cart", "Your cart is empty.");
  if (!code) {
    await touch(cart.id, { discountCode: null });
    return { ok: true as const };
  }
  const d = await loadDiscount(code);
  if (!d) throw new AppError(400, "bad_code", "That code isn't valid.");
  const avail = discountAvailability(d, new Date());
  if (!avail.ok) throw new AppError(400, "bad_code", avail.reason);
  await touch(cart.id, { discountCode: d.code });
  return { ok: true as const };
}

export async function touch(cartId: string, data: Prisma.CartUpdateInput = {}) {
  await prisma.cart.update({ where: { id: cartId }, data: { ...data, lastActivityAt: new Date() } });
}

export function cartDto(p: PricedCart) {
  return {
    id: p.cart.id,
    email: p.cart.email,
    recoveryConsent: p.cart.recoveryConsent,
    discountCode: p.cart.discountCode,
    items: p.cart.items.map((i) => ({
      id: i.id,
      projectId: i.projectId,
      designId: i.project.designId,
      designName: getSellableDesign(i.project.designId)?.name ?? i.project.designId,
      colorwayId: i.project.colorwayId,
      fields: i.project.fields,
      options: i.project.options,
      peaks: i.project.peaks,
      variant: variantDto(i.variant),
      frameFinish: i.frameFinish,
      quantity: i.quantity,
      lineTotalCents: p.quote.lines.find((l) => l.key === i.id)?.lineTotalCents ?? 0,
      problems: p.problems[i.id] ?? [],
    })),
    quote: p.quote,
  };
}
