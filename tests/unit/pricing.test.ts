import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allocate, discountAvailability, normaliseCode, quote, shippingMethods, type DiscountRule } from "../../src/lib/commerce";

const ship = shippingMethods({ leadMin: 5, leadMax: 9 })[0];
const line = (key: string, variantId: string, price: number, qty = 1) => ({ key, variantId, label: key, unitPriceCents: price, quantity: qty });
const rule = (r: Partial<DiscountRule>): DiscountRule => ({ code: "X", type: "percent", value: 10, minSubtotalCents: 0, variantIds: [], ...r });

describe("quote", () => {
  it("sums lines in integer cents", () => {
    const q = quote({ lines: [line("a", "framed-12x16", 9900, 2), line("b", "print-8x10", 3500)], shipping: ship });
    assert.equal(q.subtotalCents, 23300);
    assert.equal(q.shippingCents, 0);
    assert.equal(q.totalCents, 23300);
    assert.equal(q.itemCount, 3);
    assert.equal(q.taxCents, null, "tax is left to Stripe Tax");
  });

  it("rejects invalid quantities and prices", () => {
    assert.throws(() => quote({ lines: [line("a", "v", 9900, 0)], shipping: ship }));
    assert.throws(() => quote({ lines: [line("a", "v", 9900, 11)], shipping: ship }));
    assert.throws(() => quote({ lines: [line("a", "v", 99.5)], shipping: ship }));
    assert.throws(() => quote({ lines: [line("a", "v", -1)], shipping: ship }));
  });

  it("caps an order at 20 pieces", () => {
    assert.throws(() => quote({ lines: [line("a", "v", 100, 10), line("b", "v", 100, 10), line("c", "v", 100, 1)], shipping: ship }));
  });

  it("applies percent discounts with rounding and allocates exactly", () => {
    const q = quote({ lines: [line("a", "v1", 9999), line("b", "v2", 3333)], discount: rule({ value: 15 }), shipping: ship });
    assert.equal(q.discountCents, Math.round((13332 * 15) / 100));
    assert.equal(q.lines.reduce((s, l) => s + l.discountCents, 0), q.discountCents);
    assert.equal(q.totalCents, 13332 - q.discountCents);
  });

  it("never discounts below zero with fixed amounts", () => {
    const q = quote({ lines: [line("a", "v", 3500)], discount: rule({ type: "fixed", value: 10_000 }), shipping: ship });
    assert.equal(q.discountCents, 3500);
    assert.equal(q.totalCents, 0);
  });

  it("free shipping zeroes shipping only", () => {
    const express = { ...ship, id: "express", amountCents: 1500 };
    const q = quote({ lines: [line("a", "v", 4900)], discount: rule({ type: "free_shipping" }), shipping: express });
    assert.equal(q.shippingCents, 0);
    assert.equal(q.discountCents, 0);
    assert.equal(q.totalCents, 4900);
  });

  it("enforces minimum spend", () => {
    const q = quote({ lines: [line("a", "v", 3500)], discount: rule({ code: "BIG", minSubtotalCents: 5000 }), shipping: ship });
    assert.equal(q.discount, null);
    assert.match(q.discountMessage ?? "", /at least \$50/);
    assert.equal(q.totalCents, 3500);
  });

  it("limits product-specific discounts to eligible lines", () => {
    const q = quote({ lines: [line("a", "framed-12x16", 9900), line("b", "print-8x10", 3500)], discount: rule({ value: 10, variantIds: ["framed-12x16"] }), shipping: ship });
    assert.equal(q.discountCents, 990);
    assert.equal(q.lines.find((l) => l.key === "b")!.discountCents, 0);
  });

  it("reports a product-specific code that matches nothing", () => {
    const q = quote({ lines: [line("a", "print-8x10", 3500)], discount: rule({ variantIds: ["framed-18x24"] }), shipping: ship });
    assert.equal(q.discount, null);
    assert.ok(q.discountMessage);
  });
});

describe("allocate", () => {
  it("splits exactly with largest remainder", () => {
    assert.deepEqual(allocate(10, [1, 1, 1]), [4, 3, 3]);
    assert.equal(allocate(997, [333, 333, 334]).reduce((a, b) => a + b, 0), 997);
    assert.deepEqual(allocate(0, [5, 5]), [0, 0]);
  });
});

describe("shippingMethods", () => {
  it("offers express only when priced", () => {
    assert.equal(shippingMethods({ leadMin: 5, leadMax: 9 }).length, 1);
    const both = shippingMethods({ leadMin: 5, leadMax: 9, expressCents: 1800 });
    assert.equal(both.length, 2);
    assert.equal(both[1].amountCents, 1800);
  });
});

describe("discountAvailability", () => {
  const base = { active: true, startsAt: null, endsAt: null, maxRedemptions: null, timesRedeemed: 0, maxPerCustomer: null };
  const now = new Date("2026-10-01T12:00:00Z");
  it("checks active, dates, and limits", () => {
    assert.equal(discountAvailability(base, now).ok, true);
    assert.equal(discountAvailability({ ...base, active: false }, now).ok, false);
    assert.equal(discountAvailability({ ...base, startsAt: new Date("2026-11-01") }, now).ok, false);
    assert.equal(discountAvailability({ ...base, endsAt: new Date("2026-09-01") }, now).ok, false);
    assert.equal(discountAvailability({ ...base, maxRedemptions: 5, timesRedeemed: 5 }, now).ok, false);
    assert.equal(discountAvailability({ ...base, maxPerCustomer: 1 }, now, 1).ok, false);
    assert.equal(discountAvailability({ ...base, maxPerCustomer: 1 }, now, 0).ok, true);
  });
  it("normalises codes", () => {
    assert.equal(normaliseCode("  welcome 10 "), "WELCOME10");
  });
});
