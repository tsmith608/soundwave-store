import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withBleed } from "../../src/lib/art/node";
import { getDesign, renderArtwork, samplePeaks } from "../../src/lib/art";
import { mapOrder } from "../../src/lib/server/fulfillment/prodigi";

describe("print files", () => {
  const d = getDesign("herbarium")!;
  const svg = renderArtwork(d, d.sample, samplePeaks("t", "voice"), { widthIn: 12, heightIn: 16, showQr: true, qrUrl: "https://example.com/l/abc" });
  it("renders deterministically", () => {
    const again = renderArtwork(d, d.sample, samplePeaks("t", "voice"), { widthIn: 12, heightIn: 16, showQr: true, qrUrl: "https://example.com/l/abc" });
    assert.equal(svg, again);
  });
  it("adds bleed around the exact trim size", () => {
    const b = withBleed(svg, 12, 16, 0.125, "#EEE");
    assert.equal(b.widthIn, 12.25);
    assert.equal(b.heightIn, 16.25);
    assert.match(b.svg, /width="12.25in" height="16.25in"/);
    assert.match(b.svg, /x="0.125" y="0.125" width="12" height="16"/);
    assert.equal(withBleed(svg, 12, 16, 0, "#EEE").svg, svg);
  });
});

describe("Prodigi status mapping", () => {
  it("maps stages, production and shipments", () => {
    assert.equal(mapOrder({ id: "o1", status: { stage: "InProgress", details: {} } }).status, "submitted");
    assert.equal(mapOrder({ id: "o1", status: { stage: "InProgress", details: { inProduction: "InProgress" } } }).status, "in_production");
    const shipped = mapOrder({ id: "o1", status: { stage: "InProgress" }, shipments: [{ id: "s1", carrier: { name: "USPS", service: "Priority" }, tracking: { number: "9400", url: "https://t" }, dispatchDate: "2026-10-01T00:00:00Z" }] });
    assert.equal(shipped.status, "shipped");
    assert.equal(shipped.shipments[0].trackingNumber, "9400");
    assert.equal(mapOrder({ id: "o1", status: { stage: "Cancelled" } }).status, "cancelled");
    assert.equal(mapOrder({ id: "o1", status: { stage: "Complete" } }).status, "complete");
    const held = mapOrder({ id: "o1", status: { stage: "InProgress", issues: [{ errorCode: "items.assets.NotDownloaded", description: "Asset 404" }] } });
    assert.equal(held.status, "on_hold");
    assert.equal(held.issues.length, 1);
    assert.equal(mapOrder({ id: "o1", charges: [{ totalCost: { amount: "42.50", currency: "USD" } }] }).costCents, 4250);
  });
});
