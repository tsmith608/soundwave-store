import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { makePendingOrder, prisma, resetDb } from "./helpers";
import { fakeSession } from "../../src/lib/server/payments/fakeEvents";
import { markPaidFromSession } from "../../src/lib/server/orders/payment";
import { renderOrder } from "../../src/lib/server/render/printFiles";
import { applyProviderState, submitFulfillment } from "../../src/lib/server/fulfillment/service";
import { runRetention } from "../../src/lib/server/retention";
import { removeRecording } from "../../src/lib/server/orders/takedown";

const customer = { email: "a@b.co", name: "Sam Lee", line1: "5 Oak Ave", city: "Denver", state: "CO", postalCode: "80202" };

before(resetDb);
after(() => prisma.$disconnect());

async function paidOrder() {
  const o = await makePendingOrder();
  await markPaidFromSession(fakeSession(o, customer, "paid") as unknown as Stripe.Checkout.Session);
  return o;
}

describe("print rendering + fulfillment", () => {
  it("renders production files once, at 300 DPI, and moves the order to ready", async () => {
    const o = await paidOrder();
    await renderOrder(o.id);
    await renderOrder(o.id); // idempotent
    const assets = await prisma.generatedAsset.findMany({ where: { orderItemId: o.items[0].id } });
    assert.deepEqual(assets.map((a) => a.kind).sort(), ["preview_png", "print_pdf", "print_png"]);
    const png = assets.find((a) => a.kind === "print_png")!;
    assert.equal(png.widthPx, 3600);
    assert.equal(png.heightPx, 4800);
    assert.equal(png.dpi, 300);
    assert.match(png.rendererVersion, /herbarium@v1/);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "ready_for_fulfillment");
  });

  it("submits to the lab exactly once, even when retried", async () => {
    const o = await paidOrder();
    await renderOrder(o.id);
    await submitFulfillment(o.id);
    await submitFulfillment(o.id);
    const fs = await prisma.fulfillment.findMany({ where: { orderId: o.id } });
    assert.equal(fs.length, 1);
    assert.ok(fs[0].providerOrderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "submitted_to_fulfillment");
  });

  it("keeps a paid order safe when the lab is down, then recovers on retry", async () => {
    const o = await paidOrder();
    await renderOrder(o.id);
    process.env.MOCK_FULFILLMENT_FAIL = "true";
    await assert.rejects(submitFulfillment(o.id));
    let ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { fulfillments: true } });
    assert.equal(ord.status, "ready_for_fulfillment");
    assert.equal(ord.attentionReason, "fulfillment_failed");
    assert.equal(ord.fulfillments[0].status, "failed");
    assert.match(ord.fulfillments[0].lastError ?? "", /down/);
    delete process.env.MOCK_FULFILLMENT_FAIL;
    await submitFulfillment(o.id);
    ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { fulfillments: true } });
    assert.equal(ord.status, "submitted_to_fulfillment");
    assert.equal(ord.attentionReason, null);
    assert.equal(ord.fulfillments.length, 1, "same fulfillment record reused");
  });

  it("applies lab updates idempotently: production → shipped → delivered", async () => {
    const o = await paidOrder();
    await renderOrder(o.id);
    await submitFulfillment(o.id);
    const f = await prisma.fulfillment.findFirstOrThrow({ where: { orderId: o.id } });
    const base = { providerOrderId: f.providerOrderId!, providerStatus: "InProgress", issues: [], costCents: 4200, costCurrency: "USD" };
    await applyProviderState(f.id, { ...base, status: "in_production", shipments: [] }, "callback");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "in_production");
    const shipment = { id: "s1", carrier: "USPS", service: "Ground", trackingNumber: "9400111", trackingUrl: "https://t", shippedAt: new Date(), delivered: false };
    await applyProviderState(f.id, { ...base, status: "shipped", shipments: [shipment] }, "callback");
    await applyProviderState(f.id, { ...base, status: "shipped", shipments: [shipment] }, "sync"); // duplicate
    assert.equal(await prisma.shipment.count({ where: { orderId: o.id } }), 1);
    assert.equal(await prisma.job.count({ where: { dedupeKey: { startsWith: "email:shipped:" }, payload: { path: ["orderId"], equals: o.id } } }), 1);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "shipped");
    // An old "in production" callback arriving late must not move it backwards.
    await applyProviderState(f.id, { ...base, status: "in_production", shipments: [] }, "callback");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "shipped");
    await applyProviderState(f.id, { ...base, status: "complete", shipments: [{ ...shipment, delivered: true }] }, "sync");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "delivered");
  });

  it("lab issues flag the order for a human", async () => {
    const o = await paidOrder();
    await renderOrder(o.id);
    await submitFulfillment(o.id);
    const f = await prisma.fulfillment.findFirstOrThrow({ where: { orderId: o.id } });
    await applyProviderState(f.id, { providerOrderId: f.providerOrderId!, status: "on_hold", providerStatus: "InProgress", shipments: [], issues: ["items.assets.NotDownloaded: 404"], costCents: null, costCurrency: null }, "callback");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).attentionReason, "fulfillment_issue");
  });
});

describe("privacy", () => {
  it("takedown deletes the recording and disables playback; retention leaves QR recordings alone", async () => {
    const o = await paidOrder();
    const before = await runRetention({ apply: false });
    assert.equal(before.some((r) => r.id === o.items[0].audioAssetId), false, "paid QR recording is kept");
    await removeRecording(o.number, { apply: true, actor: "test" });
    const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: o.items[0].id }, include: { audioAsset: true } });
    assert.ok(item.recordingRemovedAt);
    assert.equal(item.audioAsset?.status, "deleted");
  });
});
