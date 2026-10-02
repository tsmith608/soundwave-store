import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DIGITAL_DELIVERY } from "../../src/lib/commerce";
import { DIGITAL } from "../../src/lib/catalog";
import { availableShipping, needsShipping } from "../../src/lib/server/catalog";
import { canTransition } from "../../src/lib/server/orders/state";

const v = (format: "print" | "framed" | "digital", min = 0, max = 0) => ({ format, leadTimeMinDays: min, leadTimeMaxDays: max });

describe("digital files", () => {
  it("is priced below every print and renders at 300 DPI", () => {
    assert.equal(DIGITAL.priceCents, 1900);
    assert.equal(DIGITAL.widthIn * DIGITAL.pngDpi, 3600);
    assert.equal(DIGITAL.heightIn * DIGITAL.pngDpi, 4800);
  });
  it("needs no shipping when the cart is digital-only", () => {
    assert.equal(needsShipping([v("digital")]), false);
    assert.equal(needsShipping([v("digital"), v("print")]), true);
    assert.deepEqual(availableShipping([v("digital")]), [DIGITAL_DELIVERY]);
    assert.equal(DIGITAL_DELIVERY.amountCents, 0);
  });
  it("takes lead times from physical items only in a mixed cart", () => {
    const methods = availableShipping([v("digital"), v("framed", 6, 11)]);
    assert.ok(!methods.some((m) => m.id === DIGITAL_DELIVERY.id));
    assert.equal(methods[0].maxBusinessDays >= 11, true);
  });
  it("lets a digital-only order go straight from ready to delivered", () => {
    assert.ok(canTransition("ready_for_fulfillment", "delivered"));
  });
});
