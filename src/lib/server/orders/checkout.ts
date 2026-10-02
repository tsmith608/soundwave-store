import type { Prisma } from "@prisma/client";
import { ART_ENGINE_VERSION, getSellableDesign, type ArtFields } from "@/lib/art";
import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";
import { getEnv } from "../env";
import { AppError } from "../http";
import { log } from "../log";
import { ownsRecord, type Owner } from "../auth";
import { getCart, priceCart } from "../cart";
import { availableShipping, needsShipping, variantDto } from "../catalog";
import { payments } from "../payments";
import type { ProjectOptions } from "../projects";
import { nextOrderNumber } from "./state";

/**
 * Starts checkout for the visitor's cart:
 *  1. re-validates every item and re-prices from the database,
 *  2. creates the Order (pending_payment) with immutable item snapshots,
 *  3. opens a Stripe Checkout Session for exactly those amounts.
 * Payment is only ever confirmed by the Stripe webhook (orders/payment.ts).
 */
export async function startCheckout(owner: Owner, opts: { email?: string | null }) {
  const env = getEnv();
  const cart = await getCart(owner, false);
  if (!cart || cart.items.length === 0) throw new AppError(400, "empty_cart", "Your cart is empty.");
  for (const item of cart.items) {
    if (!ownsRecord(owner, item.project) && !(cart.userId && item.project.userId === cart.userId)) {
      throw new AppError(403, "not_owner", "One of the designs in your cart belongs to another session. Please add it again.");
    }
  }
  const email = (opts.email ?? cart.email ?? null)?.toLowerCase() || null;
  const priced = await priceCart(cart, { email });
  const problemItems = Object.keys(priced.problems);
  if (problemItems.length) throw new AppError(400, "cart_incomplete", "Some items in your cart need attention before checkout.");
  const q = priced.quote;

  // Double-click / refresh guard: reuse a checkout started for the same cart contents in the last 2 minutes.
  const cartHash = sha256(JSON.stringify({ items: cart.items.map((i) => [i.id, i.projectId, i.variantId, i.frameFinish, i.quantity, i.project.updatedAt.getTime()]), d: cart.discountCode, email }));
  const recent = await prisma.order.findFirst({ where: { cartId: cart.id, status: "pending_payment", createdAt: { gt: new Date(Date.now() - 120_000) } }, orderBy: { createdAt: "desc" } });
  const recentMeta = recent?.pricingSnapshot as { cartHash?: string; checkoutUrl?: string } | undefined;
  if (recent && recentMeta?.cartHash === cartHash && recentMeta.checkoutUrl) {
    return { orderId: recent.id, orderNumber: recent.number, checkoutUrl: recentMeta.checkoutUrl, totalCents: recent.totalCents };
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const templates = new Map((await prisma.designTemplate.findMany()).map((t) => [t.id, t]));

  const order = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx);
    const itemsData: Prisma.OrderItemCreateWithoutOrderInput[] = cart.items.map((i) => {
      const design = getSellableDesign(i.project.designId)!;
      const v = i.variant;
      const options = i.project.options as unknown as ProjectOptions;
      const listenToken = options.showQr ? randomToken(12) : null;
      const line = q.lines.find((l) => l.key === i.id)!;
      const spec = {
        version: 2,
        engineVersion: ART_ENGINE_VERSION,
        designId: design.id,
        templateVersion: templates.get(design.id)?.version ?? design.templateVersion ?? 1,
        colorwayId: i.project.colorwayId,
        fields: i.project.fields as unknown as ArtFields,
        peaks: i.project.peaks as number[],
        showQr: options.showQr,
        qrStyle: options.qrStyle,
        qrUrl: listenToken ? `${appUrl}/l/${listenToken}` : null,
        listenUrl: options.listenUrl,
        sizeId: v.sizeId,
        format: v.format,
        frameFinish: i.frameFinish,
        widthIn: Number(v.widthIn),
        heightIn: Number(v.heightIn),
      };
      return {
        variant: { connect: { id: v.id } },
        productName: v.label,
        sku: v.sku,
        format: v.format,
        sizeId: v.sizeId,
        frameFinish: i.frameFinish,
        quantity: i.quantity,
        unitPriceCents: v.priceCents,
        lineTotalCents: line.lineTotalCents,
        designId: design.id,
        designName: design.name,
        templateVersion: spec.templateVersion,
        artworkSpec: spec as unknown as Prisma.InputJsonValue,
        audioAsset: i.project.audioAssetId ? { connect: { id: i.project.audioAssetId } } : undefined,
        listenToken,
        rightsConfirmedAt: i.project.rightsConfirmedAt,
      };
    });

    // Any older unpaid checkout for this cart is superseded (its Stripe session is expired below).
    const superseded = await tx.order.findMany({ where: { cartId: cart.id, status: "pending_payment" }, select: { id: true, stripeCheckoutSessionId: true } });
    for (const s of superseded) {
      await tx.order.update({ where: { id: s.id }, data: { status: "cancelled", cancelledAt: new Date() } });
      await tx.orderEvent.create({ data: { orderId: s.id, type: "status_changed", fromStatus: "pending_payment", toStatus: "cancelled", actor: "system", message: "Superseded by a newer checkout for the same cart." } });
    }

    const created = await tx.order.create({
      data: {
        number,
        userId: owner.userId ?? cart.userId,
        cartId: cart.id,
        email: email ?? "",
        status: "pending_payment",
        subtotalCents: q.subtotalCents,
        discountCents: q.discountCents,
        shippingCents: q.shippingCents,
        taxCents: 0,
        totalCents: q.totalCents,
        discountCode: q.discount?.code ?? null,
        shippingMethod: q.shipping.id,
        pricingSnapshot: { quote: q, cartHash } as unknown as Prisma.InputJsonValue,
        attribution: cart.attribution ?? undefined,
        items: { create: itemsData },
        events: { create: { type: "status_changed", toStatus: "pending_payment", actor: "customer", message: "Checkout started." } },
      },
      include: { items: true },
    });
    return { created, superseded };
  });

  for (const s of order.superseded) if (s.stripeCheckoutSessionId) void payments().expireCheckoutSession(s.stripeCheckoutSessionId);

  const o = order.created;
  const shipping = availableShipping(cart.items.map((i) => variantDto(i.variant))).map((m) => ({ ...m, amountCents: q.discount?.type === "free_shipping" && m.id === "standard" ? 0 : m.amountCents }));
  let session: { id: string; url: string };
  try {
    session = await payments().createCheckoutSession({
      orderId: o.id,
      orderNumber: o.number,
      email,
      lines: o.items.map((it) => ({
        name: `${it.designName} — ${it.productName}`,
        description: [(it.artworkSpec as { fields?: ArtFields }).fields?.title, it.frameFinish ? `${it.frameFinish} frame` : null].filter(Boolean).join(" · ") || undefined,
        unitAmountCents: it.unitPriceCents,
        quantity: it.quantity,
        metadata: { orderItemId: it.id, sku: it.sku },
        taxCode: it.format === "digital" ? env.STRIPE_TAX_CODE_DIGITAL : undefined,
      })),
      discount: q.discountCents > 0 && q.discount ? { code: q.discount.code, amountOffCents: q.discountCents } : null,
      shipping: q.discount?.type === "free_shipping" ? shipping.filter((m) => m.id === "standard") : shipping,
      requiresShipping: needsShipping(cart.items.map((i) => i.variant)),
      successUrl: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/cart?checkout=cancelled`,
    });
  } catch (err) {
    log.error("checkout_session_failed", { orderId: o.id, err });
    await prisma.$transaction([
      prisma.order.update({ where: { id: o.id }, data: { status: "failed" } }),
      prisma.orderEvent.create({ data: { orderId: o.id, type: "error", fromStatus: "pending_payment", toStatus: "failed", actor: "system", message: "Payment provider unavailable when starting checkout." } }),
    ]);
    throw new AppError(502, "payment_unavailable", "Our payment provider didn't respond. Your cart is saved — please try again in a moment.");
  }

  await prisma.order.update({
    where: { id: o.id },
    data: { stripeCheckoutSessionId: session.id, pricingSnapshot: { quote: q, cartHash, checkoutUrl: session.url } as unknown as Prisma.InputJsonValue },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { status: "checking_out", email: email ?? cart.email, lastActivityAt: new Date() } });
  log.info("checkout_started", { orderId: o.id, number: o.number, totalCents: o.totalCents, provider: payments().name });
  return { orderId: o.id, orderNumber: o.number, checkoutUrl: session.url, totalCents: o.totalCents };
}
