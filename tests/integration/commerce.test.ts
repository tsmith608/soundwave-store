import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { makePendingOrder, prisma, resetDb } from "./helpers";
import { fakeEvent, fakeSession } from "../../src/lib/server/payments/fakeEvents";
import { handleStripeEvent, markPaidFromSession } from "../../src/lib/server/orders/payment";
import { ingestWebhook } from "../../src/lib/server/webhooks";
import { createRefund, cancelOrder } from "../../src/lib/server/orders/refunds";
import { transition, TransitionError } from "../../src/lib/server/orders/state";
import { claimJobs, enqueue } from "../../src/lib/server/jobs/queue";
import { rateLimit } from "../../src/lib/server/rateLimit";

const customer = { email: "Buyer@Example.com", name: "Pat Buyer", line1: "1 Main St", city: "Austin", state: "TX", postalCode: "78701" };
const session = (o: Awaited<ReturnType<typeof makePendingOrder>>, status: "paid" | "unpaid" = "paid") => fakeSession(o, customer, status) as unknown as Stripe.Checkout.Session;
const event = (type: string, obj: unknown) => fakeEvent(type, obj) as unknown as Stripe.Event;

before(resetDb);
after(() => prisma.$disconnect());

describe("payment webhooks", () => {
  beforeEach(() => prisma.job.deleteMany());

  it("marks paid, records payment, snapshots address, queues render + email once", async () => {
    const o = await makePendingOrder();
    await markPaidFromSession(session(o));
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { payments: true, events: true } });
    assert.equal(paid.status, "paid");
    assert.ok(paid.paidAt);
    assert.equal(paid.email, "buyer@example.com");
    assert.equal(paid.shipCity, "Austin");
    assert.equal(paid.payments.length, 1);
    assert.ok(paid.events.some((e) => e.toStatus === "paid"));
    const cart = await prisma.cart.findUniqueOrThrow({ where: { id: o.cartId! } });
    assert.equal(cart.status, "converted");
    const asset = await prisma.uploadedAsset.findUniqueOrThrow({ where: { id: o.items[0].audioAssetId! } });
    assert.equal(asset.expiresAt, null, "recording now follows order retention");

    // Duplicate delivery / reconciliation: no second payment, no extra jobs.
    const again = await markPaidFromSession(session(o));
    assert.equal(again.changed, false);
    assert.equal(await prisma.payment.count({ where: { orderId: o.id } }), 1);
    const jobs = await prisma.job.findMany({ where: { payload: { path: ["orderId"], equals: o.id } } });
    assert.deepEqual(jobs.map((j) => j.type).sort(), ["render_order", "send_email"]);
  });

  it("stores each webhook once and ignores duplicate deliveries", async () => {
    const o = await makePendingOrder();
    const ev = event("checkout.session.completed", session(o));
    const first = await ingestWebhook("stripe", ev.id, ev.type, ev, (p) => handleStripeEvent(p as Stripe.Event));
    const second = await ingestWebhook("stripe", ev.id, ev.type, ev, (p) => handleStripeEvent(p as Stripe.Event));
    assert.equal(first.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(await prisma.webhookEvent.count({ where: { eventId: ev.id } }), 1);
  });

  it("handles out-of-order events: an 'expired' after 'paid' changes nothing", async () => {
    const o = await makePendingOrder();
    await handleStripeEvent(event("checkout.session.completed", session(o)));
    await handleStripeEvent(event("checkout.session.expired", session(o, "unpaid")));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "paid");
  });

  it("accepts a late payment for a cancelled checkout and flags it", async () => {
    const o = await makePendingOrder();
    await handleStripeEvent(event("checkout.session.expired", session(o, "unpaid")));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "cancelled");
    await handleStripeEvent(event("checkout.session.completed", session(o)));
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    assert.equal(after.status, "paid");
    assert.equal(after.attentionReason, "paid_after_cancel");
  });

  it("async payment failure fails the order and emails once", async () => {
    const o = await makePendingOrder();
    await handleStripeEvent(event("checkout.session.completed", session(o, "unpaid")));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "pending_payment");
    await handleStripeEvent(event("checkout.session.async_payment_failed", session(o, "unpaid")));
    await handleStripeEvent(event("checkout.session.async_payment_failed", session(o, "unpaid")));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status, "failed");
    assert.equal(await prisma.job.count({ where: { dedupeKey: `email:payment_failed:${o.id}` } }), 1);
  });

  it("redeems a discount exactly once", async () => {
    const d = await prisma.discount.create({ data: { code: `T${Date.now()}`, type: "percent", value: 10, maxRedemptions: 5 } });
    const o = await makePendingOrder({ discountCode: d.code });
    await markPaidFromSession(session(o));
    await markPaidFromSession(session(o));
    assert.equal((await prisma.discount.findUniqueOrThrow({ where: { id: d.id } })).timesRedeemed, 1);
    assert.equal(await prisma.discountRedemption.count({ where: { orderId: o.id } }), 1);
  });
});

describe("state machine (database)", () => {
  it("refuses illegal transitions and concurrent double-application", async () => {
    const o = await makePendingOrder();
    await assert.rejects(prisma.$transaction((tx) => transition(tx, o.id, "shipped", { actor: "test" })), TransitionError);
    const results = await Promise.allSettled([1, 2, 3].map(() => prisma.$transaction((tx) => transition(tx, o.id, "paid", { actor: "test", allowNoop: false }))));
    const changed = results.filter((r) => r.status === "fulfilled").length;
    assert.ok(changed >= 1);
    const events = await prisma.orderEvent.count({ where: { orderId: o.id, toStatus: "paid" } });
    assert.equal(events, 1, "only one transition recorded");
  });
});

describe("refunds", () => {
  it("partial then full refund; never over-refunds; double submit is safe", async () => {
    const o = await makePendingOrder({ totalCents: 9900 });
    await markPaidFromSession(session(o));
    const r1 = await createRefund(o.id, 2000, "goodwill", "test");
    assert.equal(r1.status, "succeeded");
    let ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    assert.equal(ord.refundedCents, 2000);
    assert.equal(ord.status, "paid", "partial refund doesn't hide lifecycle");
    await assert.rejects(createRefund(o.id, 8000, "too much", "test"), /At most 79.00/);
    // Two clicks at once: exactly one refund row is created for the same slot.
    const both = await Promise.allSettled([createRefund(o.id, 7900, "rest", "a"), createRefund(o.id, 7900, "rest", "b")]);
    assert.equal(both.filter((r) => r.status === "fulfilled").length, 1);
    ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    assert.equal(ord.refundedCents, 9900);
    assert.equal(ord.status, "refunded");
  });

  it("cancel before production refunds in full", async () => {
    const o = await makePendingOrder({ totalCents: 4900 });
    await markPaidFromSession(session(o));
    await cancelOrder(o.id, { refund: true, reason: "customer changed mind", actor: "test" });
    const ord = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    assert.equal(ord.status, "cancelled");
    assert.equal(ord.refundedCents, 4900);
    assert.ok(await prisma.job.findUnique({ where: { dedupeKey: `email:cancelled:${o.id}` } }));
  });
});

describe("job queue", () => {
  it("never hands the same job to two workers", async () => {
    await prisma.job.deleteMany();
    for (let i = 0; i < 20; i++) await enqueue(prisma, "cleanup", { i });
    const [a, b, c] = await Promise.all([claimJobs("w1", 10), claimJobs("w2", 10), claimJobs("w3", 10)]);
    const ids = [...a, ...b, ...c].map((j) => j.id);
    assert.equal(ids.length, 20);
    assert.equal(new Set(ids).size, 20);
  });
  it("deduplicates active jobs by key", async () => {
    const j1 = await enqueue(prisma, "render_order", { orderId: "x" }, { dedupeKey: "render_order:x" });
    const j2 = await enqueue(prisma, "render_order", { orderId: "x" }, { dedupeKey: "render_order:x" });
    assert.equal(j1.id, j2.id);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", async () => {
    const who = `ip-${Date.now()}`;
    for (let i = 0; i < 5; i++) await rateLimit("login", who);
    await assert.rejects(rateLimit("login", who), (e: Error & { status?: number }) => e.status === 429);
  });
});
