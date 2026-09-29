import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assetVerdict, type OrderUse } from "../../src/lib/retention";

const now = new Date("2026-09-28T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const use = (u: Partial<OrderUse>): OrderUse => ({ orderStatus: "delivered", hasQr: false, recordingRemoved: false, deliveredAt: null, shippedAt: null, closedAt: null, ...u });
const ready = (orderUses: OrderUse[], expiresAt: Date | null = null) => ({ status: "ready" as const, expiresAt, orderUses });

describe("retention policy", () => {
  it("keeps recordings behind a printed QR code indefinitely", () => {
    assert.ok(assetVerdict(ready([use({ hasQr: true, deliveredAt: daysAgo(5000) })]), now).keep);
  });
  it("deletes no-QR recordings 90 days after delivery", () => {
    assert.equal(assetVerdict(ready([use({ deliveredAt: daysAgo(91) })]), now).keep, false);
    assert.ok(assetVerdict(ready([use({ deliveredAt: daysAgo(30) })]), now).keep);
  });
  it("assumes 21 days of transit when there is no delivery scan", () => {
    assert.ok(assetVerdict(ready([use({ orderStatus: "shipped", shippedAt: daysAgo(100) })]), now).keep);
    assert.equal(assetVerdict(ready([use({ orderStatus: "shipped", shippedAt: daysAgo(112) })]), now).keep, false);
  });
  it("keeps anything for an order still in progress", () => {
    assert.ok(assetVerdict(ready([use({ orderStatus: "in_production" })]), now).keep);
  });
  it("deletes 30 days after cancellation / abandonment", () => {
    assert.equal(assetVerdict(ready([use({ orderStatus: "cancelled", closedAt: daysAgo(31) })]), now).keep, false);
    assert.ok(assetVerdict(ready([use({ orderStatus: "cancelled", closedAt: daysAgo(3) })]), now).keep);
    assert.equal(assetVerdict(ready([use({ orderStatus: "pending_payment", closedAt: daysAgo(40) })]), now).keep, false);
  });
  it("a refunded order that shipped with a QR code keeps playing", () => {
    assert.ok(assetVerdict(ready([use({ orderStatus: "refunded", hasQr: true, shippedAt: daysAgo(200), closedAt: daysAgo(150) })]), now).keep);
  });
  it("honours takedowns immediately", () => {
    assert.equal(assetVerdict(ready([use({ hasQr: true, recordingRemoved: true })]), now).keep, false);
  });
  it("unordered uploads live until their expiry", () => {
    assert.ok(assetVerdict(ready([], daysAgo(-5)), now).keep);
    assert.equal(assetVerdict(ready([], daysAgo(1)), now).keep, false);
    assert.equal(assetVerdict({ status: "pending", expiresAt: daysAgo(1), orderUses: [] }, now).keep, false);
  });
  it("a shared recording is kept if any order still needs it", () => {
    assert.ok(assetVerdict(ready([use({ orderStatus: "cancelled", closedAt: daysAgo(200) }), use({ hasQr: true, deliveredAt: daysAgo(200) })]), now).keep);
  });
  it("a draft still inside its window protects a recording from an old cancelled order", () => {
    assert.ok(assetVerdict(ready([use({ orderStatus: "cancelled", closedAt: daysAgo(60) })], daysAgo(-10)), now).keep);
  });
});
