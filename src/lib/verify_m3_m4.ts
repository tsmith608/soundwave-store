/**
 * Milestone 3 & Milestone 4 Verification Suite
 * Tests Stripe Checkout Creation, Webhook Signature Verification,
 * Idempotency, Order Status Query, and Preview Serving.
 */

import { POST as checkoutHandler } from "@/app/api/checkout/route";
import { POST as webhookHandler } from "@/app/api/webhooks/stripe/route";
import { GET as orderHandler } from "@/app/api/orders/[id]/route";
import { GET as previewHandler } from "@/app/api/orders/[id]/preview/route";
import { getOrderById, prisma } from "@/lib/db";
import { FRAME_SIZES } from "@/lib/constants";
import { NextRequest } from "next/server";
import crypto from "crypto";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

function createStripeSignature(
  rawBody: string,
  secret: string = "whsec_test_secret_32chars_long_1234567890",
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${ts},v1=${hmac}`;
}

async function runMilestone3And4Tests() {
  console.log("==================================================");
  console.log("   SOUNDWAVE ART — MILESTONES 3 & 4 VERIFICATION");
  console.log("==================================================");

  // --- SUITE 1: Stripe Checkout Session Creation ---
  console.log("\n--- 1. Stripe Checkout API (POST /api/checkout) ---");

  // Test all 4 frame sizes and price mappings
  for (const size of ["8x10", "11x14", "16x20", "24x36"]) {
    const config = FRAME_SIZES[size];
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: size,
        palette: "midnight_gold",
        caption: `Test Caption for ${size}`,
        customerEmail: `customer_${size}@example.com`,
      }),
    });

    const res = await checkoutHandler(req);
    assert(res.status === 200, `POST /api/checkout returns 200 for ${size}`);
    const data = await res.json();
    assert(data.success === true, `Checkout response success flag for ${size}`);
    assert(typeof data.orderId === "string" && data.orderId.startsWith("ord_"), `orderId format for ${size}`);
    assert(typeof data.checkoutUrl === "string" && data.checkoutUrl.length > 0, `checkoutUrl present for ${size}`);

    // Verify order in database
    const dbOrder = await getOrderById(data.orderId);
    assert(dbOrder !== null, `Order record created in DB for ${size}`);
    assert(dbOrder?.frameSize === size, `Order frameSize in DB is ${size}`);
    assert(dbOrder?.totalAmount === config.priceCents, `Order totalAmount in DB is ${config.priceCents} cents (${config.priceFormatted})`);
    assert(dbOrder?.status === "pending_payment", `Initial order status is pending_payment for ${size}`);
  }

  // Test invalid frame sizes rejected with 400
  const invalidSizes = ["12x18", "5x7", "custom", ""];
  for (const inv of invalidSizes) {
    const invReq = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: inv,
        palette: "midnight_gold",
      }),
    });
    const invRes = await checkoutHandler(invReq);
    assert(invRes.status === 400, `Checkout rejects invalid frame size '${inv}' with 400`);
  }

  // Test oversized caption rejected with 400
  const longCaption = "A".repeat(201);
  const overReq = new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      frameSize: "16x20",
      palette: "midnight_gold",
      caption: longCaption,
    }),
  });
  const overRes = await checkoutHandler(overReq);
  assert(overRes.status === 400, "Checkout rejects caption > 200 chars with 400");

  // --- SUITE 2: Stripe Webhook Signature Verification ---
  console.log("\n--- 2. Stripe Webhook Signature Security (POST /api/webhooks/stripe) ---");

  const webhookSecret = "whsec_test_secret_32chars_long_1234567890";
  const dummyEvent = {
    id: `evt_sec_${Date.now()}`,
    type: "checkout.session.completed",
    data: { object: { metadata: { orderId: "ord_dummy" } } },
  };
  const dummyPayload = JSON.stringify(dummyEvent);

  // Missing signature header
  const noSigReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body: dummyPayload,
  });
  const noSigRes = await webhookHandler(noSigReq);
  assert(noSigRes.status === 400, "Webhook rejects missing signature header with 400");

  // Empty signature header
  const emptySigReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "   " },
    body: dummyPayload,
  });
  const emptySigRes = await webhookHandler(emptySigReq);
  assert(emptySigRes.status === 400, "Webhook rejects empty signature header with 400");

  // Malformed signature scheme (missing v1=)
  const malformedReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1726799000" },
    body: dummyPayload,
  });
  const malformedRes = await webhookHandler(malformedReq);
  assert(malformedRes.status === 400, "Webhook rejects malformed signature header with 400");

  // Expired timestamp (> 300 seconds)
  const expiredTs = Math.floor(Date.now() / 1000) - 305;
  const expiredSig = createStripeSignature(dummyPayload, webhookSecret, expiredTs);
  const expiredReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": expiredSig },
    body: dummyPayload,
  });
  const expiredRes = await webhookHandler(expiredReq);
  assert(expiredRes.status === 400, "Webhook rejects expired signature (>300s) with 400");

  // Tampered HMAC hash
  const validSig = createStripeSignature(dummyPayload, webhookSecret);
  const tamperedSig = validSig.slice(0, -4) + "dead";
  const tamperedReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": tamperedSig },
    body: dummyPayload,
  });
  const tamperedRes = await webhookHandler(tamperedReq);
  assert(tamperedRes.status === 400, "Webhook rejects tampered signature with 400");

  // --- SUITE 3: Webhook Event Processing & Idempotency ---
  console.log("\n--- 3. Webhook Event Processing & Idempotency ---");

  // Create an order to be paid
  const testCheckoutReq = new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      frameSize: "16x20",
      palette: "dark_blue_white",
      caption: "Our Sacred Wedding Vows",
      customerEmail: "sarah.david@example.com",
    }),
  });
  const testCheckoutRes = await checkoutHandler(testCheckoutReq);
  const testCheckoutData = await testCheckoutRes.json();
  const testOrderId = testCheckoutData.orderId;

  const eventId = `evt_test_${Date.now()}`;
  const checkoutCompletedEvent = {
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${testOrderId}`,
        customer_details: {
          email: "sarah.david@example.com",
          name: "Sarah & David Jenkins",
        },
        shipping_details: {
          name: "Sarah Jenkins",
          address: {
            line1: "742 Evergreen Terrace",
            city: "Springfield",
            state: "OR",
            postal_code: "97477",
            country: "US",
          },
        },
        metadata: {
          orderId: testOrderId,
          frameSize: "16x20",
          paletteId: "dark_blue_white",
        },
      },
    },
  };

  const completedPayload = JSON.stringify(checkoutCompletedEvent);
  const validCompletedSig = createStripeSignature(completedPayload, webhookSecret);

  // Send valid webhook
  const validWebReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": validCompletedSig },
    body: completedPayload,
  });
  const validWebRes = await webhookHandler(validWebReq);
  assert(validWebRes.status === 200, "Valid checkout.session.completed returns 200");
  const validWebData = await validWebRes.json();
  assert(validWebData.received === true, "Webhook response received: true");

  // Verify order transitioned to pending_fulfillment
  const updatedOrder = await getOrderById(testOrderId);
  assert(updatedOrder?.status === "pending_fulfillment", "Order status transitioned to pending_fulfillment");
  assert(updatedOrder?.shippingName === "Sarah Jenkins", "Order shippingName updated from session");
  assert(Boolean(updatedOrder?.shippingAddress?.includes("Springfield")), "Order shippingAddress updated from session");

  // Replay identical webhook event (Idempotency test)
  const replayWebReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": validCompletedSig },
    body: completedPayload,
  });
  const replayWebRes = await webhookHandler(replayWebReq);
  assert(replayWebRes.status === 200, "Replayed webhook returns 200");
  const replayWebData = await replayWebRes.json();
  assert(replayWebData.status === "duplicate_ignored", "Duplicate webhook correctly detected and ignored");

  // --- SUITE 4: Order Status Query & Preview Stream ---
  console.log("\n--- 4. Order Status & Preview Integration ---");

  const queryReq = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}`);
  const queryContext = { params: Promise.resolve({ id: testOrderId }) };
  const queryRes = await orderHandler(queryReq, queryContext);
  assert(queryRes.status === 200, "GET /api/orders/[id] returns 200");
  const queryData = await queryRes.json();
  assert(queryData.orderId === testOrderId, "orderId matches query result");
  assert(queryData.status === "pending_fulfillment", "Order status reflects pending_fulfillment");
  assert(queryData.statusLabel === "Payment Confirmed", "Status label is 'Payment Confirmed'");

  const prevReq = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/preview`);
  const prevContext = { params: Promise.resolve({ id: testOrderId }) };
  const prevRes = await previewHandler(prevReq, prevContext);
  assert(prevRes.status === 200, "GET /api/orders/[id]/preview returns 200");
  const contentType = prevRes.headers.get("Content-Type");
  assert(Boolean(contentType?.startsWith("image/")), `Preview returns image content type (${contentType})`);

  // Summary
  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone3And4Tests().catch((err) => {
  console.error("M3 & M4 Verification Suite failed with exception:", err);
  process.exit(1);
});
