import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition, TRANSITIONS } from "../../src/lib/server/orders/state";

describe("order state machine", () => {
  it("allows the happy path", () => {
    const path = ["pending_payment", "paid", "processing_artwork", "ready_for_fulfillment", "submitted_to_fulfillment", "in_production", "shipped", "delivered"] as const;
    for (let i = 0; i < path.length - 1; i++) assert.ok(canTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`);
  });
  it("forbids skipping payment or going backwards after shipping", () => {
    assert.equal(canTransition("pending_payment", "shipped"), false);
    assert.equal(canTransition("pending_payment", "processing_artwork"), false);
    assert.equal(canTransition("shipped", "in_production"), false);
    assert.equal(canTransition("delivered", "shipped"), false);
  });
  it("treats refunded as terminal", () => {
    assert.deepEqual(TRANSITIONS.refunded, []);
  });
  it("accepts a late payment for a cancelled checkout (money received wins)", () => {
    assert.ok(canTransition("cancelled", "paid"));
    assert.ok(canTransition("failed", "paid"));
  });
  it("lets a failed lab submission go back to ready", () => {
    assert.ok(canTransition("submitted_to_fulfillment", "ready_for_fulfillment"));
  });
});
