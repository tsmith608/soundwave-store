/**
 * Pure commerce rules shared by server (authoritative) and client (display
 * only). No I/O here, so it is exhaustively unit-tested
 * (tests/unit/pricing.test.ts). The server recomputes every quote from the
 * database before payment; client numbers are never trusted.
 */

export const MAX_QTY_PER_LINE = 10;
export const MAX_ITEMS_PER_ORDER = 20;

export interface QuoteLineInput {
  key: string;
  variantId: string;
  label: string;
  unitPriceCents: number;
  quantity: number;
}

export interface DiscountRule {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotalCents: number;
  variantIds: string[];
}

export interface ShippingMethod {
  id: string;
  label: string;
  amountCents: number;
  minBusinessDays: number;
  maxBusinessDays: number;
}

export interface QuoteLine extends QuoteLineInput {
  lineTotalCents: number;
  discountCents: number;
}

export interface Quote {
  currency: "usd";
  lines: QuoteLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  discount: { code: string; type: DiscountRule["type"]; label: string } | null;
  discountMessage: string | null;
  shipping: ShippingMethod;
  shippingCents: number;
  /** Tax is calculated by Stripe Tax at checkout from the shipping address. */
  taxCents: number | null;
  totalCents: number;
}

export function describeDiscount(d: Pick<DiscountRule, "type" | "value">): string {
  if (d.type === "percent") return `${d.value}% off`;
  if (d.type === "fixed") return `${formatCents(d.value)} off`;
  return "Free shipping";
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Splits `amount` across lines proportionally to their totals (largest remainder, so parts sum exactly). */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || amount <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const out = raw.map(Math.floor);
  let rest = amount - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    out[i]++;
    rest--;
  }
  return out;
}

export function quote(input: { lines: QuoteLineInput[]; discount?: DiscountRule | null; shipping: ShippingMethod }): Quote {
  const lines = input.lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QTY_PER_LINE) throw new Error(`Invalid quantity for ${l.label}`);
    if (!Number.isInteger(l.unitPriceCents) || l.unitPriceCents < 0) throw new Error(`Invalid price for ${l.label}`);
    return { ...l, lineTotalCents: l.unitPriceCents * l.quantity, discountCents: 0 };
  });
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0);
  if (itemCount > MAX_ITEMS_PER_ORDER) throw new Error(`Orders are limited to ${MAX_ITEMS_PER_ORDER} pieces`);
  const subtotalCents = lines.reduce((a, l) => a + l.lineTotalCents, 0);
  let shippingCents = input.shipping.amountCents;
  let discountCents = 0;
  let applied: Quote["discount"] = null;
  let discountMessage: string | null = null;

  const d = input.discount;
  if (d) {
    const eligible = lines.filter((l) => d.variantIds.length === 0 || d.variantIds.includes(l.variantId));
    const eligibleSubtotal = eligible.reduce((a, l) => a + l.lineTotalCents, 0);
    if (subtotalCents < d.minSubtotalCents) {
      discountMessage = `${d.code} needs an order of at least ${formatCents(d.minSubtotalCents)}.`;
    } else if (eligible.length === 0) {
      discountMessage = `${d.code} doesn't apply to the items in your cart.`;
    } else {
      if (d.type === "percent") discountCents = Math.round((eligibleSubtotal * Math.min(100, Math.max(0, d.value))) / 100);
      else if (d.type === "fixed") discountCents = Math.min(Math.max(0, d.value), eligibleSubtotal);
      else shippingCents = 0;
      const parts = allocate(discountCents, eligible.map((l) => l.lineTotalCents));
      eligible.forEach((l, i) => (l.discountCents = parts[i]));
      applied = { code: d.code, type: d.type, label: describeDiscount(d) };
    }
  }

  return {
    currency: "usd",
    lines,
    itemCount,
    subtotalCents,
    discountCents,
    discount: applied,
    discountMessage,
    shipping: input.shipping,
    shippingCents,
    taxCents: null,
    totalCents: subtotalCents - discountCents + shippingCents,
  };
}

/**
 * Shipping methods. Standard is included in the price (US only). Express is
 * only offered once the owner sets SHIPPING_EXPRESS_CENTS after confirming the
 * provider's express cost and transit time.
 */
export function shippingMethods(opts: { expressCents?: number | null; leadMin: number; leadMax: number }): ShippingMethod[] {
  const list: ShippingMethod[] = [{ id: "standard", label: "Standard tracked shipping", amountCents: 0, minBusinessDays: opts.leadMin, maxBusinessDays: opts.leadMax }];
  if (opts.expressCents && opts.expressCents > 0) {
    list.push({ id: "express", label: "Express shipping", amountCents: opts.expressCents, minBusinessDays: Math.max(2, opts.leadMin - 2), maxBusinessDays: Math.max(3, opts.leadMax - 3) });
  }
  return list;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

/** Server-side validity of a discount at a point in time (DB counts supplied by caller). */
export function discountAvailability(
  d: { active: boolean; startsAt: Date | null; endsAt: Date | null; maxRedemptions: number | null; timesRedeemed: number; maxPerCustomer: number | null },
  now: Date,
  customerRedemptions?: number,
): { ok: true } | { ok: false; reason: string } {
  if (!d.active) return { ok: false, reason: "That code isn't active." };
  if (d.startsAt && now < d.startsAt) return { ok: false, reason: "That code isn't active yet." };
  if (d.endsAt && now > d.endsAt) return { ok: false, reason: "That code has expired." };
  if (d.maxRedemptions != null && d.timesRedeemed >= d.maxRedemptions) return { ok: false, reason: "That code has been fully used." };
  if (d.maxPerCustomer != null && customerRedemptions != null && customerRedemptions >= d.maxPerCustomer) return { ok: false, reason: "You've already used that code." };
  return { ok: true };
}
