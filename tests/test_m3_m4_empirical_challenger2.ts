/**
 * SoundWave Art — Milestone 3 & 4 Empirical Stress Test Suite
 * Executed by Challenger 2 (Empirical Challenger)
 *
 * Stress-tests:
 * 1. Checkout Endpoint (POST /api/checkout)
 *    - Invalid frame sizes, prototype pollution / built-in property keys
 *    - Missing parameters and boundary types
 *    - Price tampering resistance (client-supplied prices ignored)
 *    - Caption boundary lengths and Unicode / surrogate stress
 *    - Malformed JSON / non-object bodies
 * 2. Webhook HMAC Signature Verification (POST /api/webhooks/stripe)
 *    - Valid signatures, forged signatures, wrong secret
 *    - Signature header formatting (multiple v1 signatures, empty/missing)
 *    - Hardcoded fallback secret leakage behavior
 * 3. Webhook Replay Attack Defense (POST /api/webhooks/stripe)
 *    - Expired timestamps (>300s past)
 *    - Future timestamps (>300s future)
 *    - Boundary timestamps (near 300s limit)
 *    - Non-numeric / malformed timestamps
 * 4. Webhook Corrupted Payloads & Event Structure
 *    - Truncated / malformed JSON
 *    - Missing event.id or event.type
 *    - Non-object JSON payloads (array, string, null)
 *    - Unhandled / unknown event types
 * 5. Webhook Idempotency & Lifecycle State Machine Defense
 *    - Sequential duplicate event delivery
 *    - Concurrent duplicate event delivery (race condition stress)
 *    - Non-regression guards for shipped / delivered / fulfillment_submitted orders
 * 6. Order Status Route (GET /api/orders/[id])
 *    - Non-existent IDs, path traversal, SQL injection patterns
 *    - Unpaired surrogates handling
 *    - All 7 order lifecycle states & status labels
 *    - Sensitive customer PII data leak check (email, address, session ID)
 * 7. Preview Route (GET /api/orders/[id]/preview)
 *    - Non-existent IDs
 *    - Path traversal attempts in URL and in poisoned DB previewUrl
 *    - Safe fallback SVG rendering with XML escaping and CSP
 *    - Existing preview file retrieval with correct Content-Type
 */

import { POST as checkoutHandler } from "@/app/api/checkout/route";
import { POST as webhookHandler } from "@/app/api/webhooks/stripe/route";
import { GET as orderHandler } from "@/app/api/orders/[id]/route";
import { GET as previewHandler } from "@/app/api/orders/[id]/preview/route";
import { createOrder, getOrderById, updateOrderStatus, prisma, ensurePragmas } from "@/lib/db";
import { FRAME_SIZES } from "@/lib/constants";
import { NextRequest } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

interface StressTestResult {
  category: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details?: string;
}

const results: StressTestResult[] = [];

function recordTest(result: StressTestResult) {
  results.push(result);
  const status = result.passed ? "[PASS]" : `[FAIL - ${result.severity || "BUG"}]`;
  console.log(`  ${status} [${result.category}] ${result.name}`);
  if (!result.passed) {
    console.log(`         Expected: ${result.expected}`);
    console.log(`         Actual:   ${result.actual}`);
    if (result.details) console.log(`         Details:  ${result.details}`);
  }
}

function makeSignature(
  rawBody: string,
  secret: string = "whsec_test_secret_32chars_long_1234567890",
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${ts},v1=${hmac}`;
}

async function runEmpiricalStressSuite() {
  await ensurePragmas();
  console.log("================================================================");
  console.log("   SOUNDWAVE ART — CHALLENGER 2 EMPIRICAL STRESS TEST SUITE");
  console.log("================================================================\n");

  const defaultWebhookSecret = "whsec_test_secret_32chars_long_1234567890";

  // =========================================================================
  // 1. CHECKOUT ENDPOINT: FRAME SIZE VALIDATION & PROTOTYPE POLLUTION
  // =========================================================================
  console.log("--- 1. Checkout Endpoint: Frame Size Validation & Property Lookups ---");

  // Valid frame sizes
  for (const size of ["8x10", "11x14", "16x20", "24x36"]) {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: size, palette: "midnight_gold" }),
    });
    const res = await checkoutHandler(req);
    const body = await res.json().catch(() => ({}));
    recordTest({
      category: "Checkout Frame Size",
      name: `Valid frame size '${size}' accepted`,
      passed: res.status === 200 && body.success === true,
      expected: "HTTP 200 with success: true",
      actual: `HTTP ${res.status}, body: ${JSON.stringify(body)}`,
      severity: "HIGH",
    });
  }

  // Invalid frame sizes - basic
  const invalidSizes = ["12x18", "5x7", "4x6", "20x30", "custom", "", "  ", "8X10", "8x10 "];
  for (const inv of invalidSizes) {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: inv, palette: "midnight_gold" }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Checkout Frame Size",
      name: `Invalid frame size '${inv}' rejected with 400`,
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Object prototype built-in keys as frameSize (e.g. toString, valueOf, constructor)
  const prototypeProperties = ["toString", "valueOf", "constructor", "__proto__", "hasOwnProperty"];
  for (const prop of prototypeProperties) {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: prop, palette: "midnight_gold" }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Checkout Frame Size - Prototype Defense",
      name: `Prototype property frameSize='${prop}' rejected with 400`,
      passed: res.status === 400,
      expected: "HTTP 400 (rejected as invalid frame size)",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
      details: res.status !== 400 ? `Object prototype key '${prop}' bypassed validation (status ${res.status})` : undefined,
    });
  }

  // Non-string frame sizes
  const nonStringSizes = [1620, true, {}, [], null];
  for (const nonStr of nonStringSizes) {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: nonStr, palette: "midnight_gold" }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Checkout Frame Size - Type Safety",
      name: `Non-string frameSize '${JSON.stringify(nonStr)}' rejected with 400`,
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // =========================================================================
  // 2. CHECKOUT ENDPOINT: PRICE TAMPERING RESISTANCE
  // =========================================================================
  console.log("\n--- 2. Checkout Endpoint: Price Tampering Resistance ---");

  const tamperingScenarios = [
    { name: "Client attempts price=1 cent", payload: { price: 1, totalAmount: 1, priceCents: 1 } },
    { name: "Client attempts price=0 free checkout", payload: { price: 0, totalAmount: 0, priceCents: 0 } },
    { name: "Client attempts negative price", payload: { price: -5000, totalAmount: -5000, priceCents: -5000 } },
    { name: "Client attempts float price", payload: { price: 0.99, priceCents: 99 } },
    { name: "Client passes unit_amount=10", payload: { unit_amount: 10 } },
  ];

  for (const scenario of tamperingScenarios) {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "24x36", // Canonical price $149 (14900 cents)
        palette: "midnight_gold",
        ...scenario.payload,
      }),
    });
    const res = await checkoutHandler(req);
    const data = await res.json();
    let priceMatchesCanonical = false;
    let actualAmount = -1;

    if (data.orderId) {
      const dbOrder = await getOrderById(data.orderId);
      actualAmount = dbOrder?.totalAmount ?? -1;
      priceMatchesCanonical = actualAmount === 14900;
    }

    recordTest({
      category: "Price Tampering Defense",
      name: `${scenario.name} does not override canonical DB price (14900)`,
      passed: priceMatchesCanonical,
      expected: "DB order totalAmount strictly 14900 cents ($149.00)",
      actual: `DB order totalAmount: ${actualAmount} cents`,
      severity: "CRITICAL",
      details: !priceMatchesCanonical ? "Client-supplied price was accepted into DB!" : undefined,
    });
  }

  // =========================================================================
  // 3. CHECKOUT ENDPOINT: CAPTION BOUNDARIES & SURROGATE STRESS
  // =========================================================================
  console.log("\n--- 3. Checkout Endpoint: Caption Boundaries & Input Sanitization ---");

  // Exact boundary 200 chars -> should succeed
  {
    const exactCaption = "C".repeat(200);
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: "8x10", caption: exactCaption }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Caption Boundaries",
      name: "Caption of exact boundary length 200 chars accepted",
      passed: res.status === 200,
      expected: "HTTP 200",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Boundary 201 chars -> must be rejected
  {
    const overflowCaption = "C".repeat(201);
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: "8x10", caption: overflowCaption }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Caption Boundaries",
      name: "Caption of length 201 chars rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Extreme length caption (10,000 chars)
  {
    const extremeCaption = "X".repeat(10000);
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({ frameSize: "8x10", caption: extremeCaption }),
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "Caption Boundaries",
      name: "Caption of length 10,000 chars rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Unpaired Unicode surrogates in caption (must not crash server / DB)
  {
    const unpairedSurrogateCaption = "Soundwave \uD800\uD800 Wedding";
    let crashed = false;
    let status = 0;
    try {
      const req = new NextRequest("http://localhost:3000/api/checkout", {
        method: "POST",
        body: JSON.stringify({ frameSize: "8x10", caption: unpairedSurrogateCaption }),
      });
      const res = await checkoutHandler(req);
      status = res.status;
    } catch (e) {
      crashed = true;
    }
    recordTest({
      category: "Surrogate Safety",
      name: "Unpaired Unicode surrogates in caption do not crash server",
      passed: !crashed && (status === 200 || status === 400),
      expected: "Handled gracefully (HTTP 200 or 400, no crash/500)",
      actual: crashed ? "Crashed with unhandled exception" : `HTTP ${status}`,
      severity: "HIGH",
    });
  }

  // Malformed JSON body
  {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: "{ frameSize: '8x10', invalid_json ",
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "JSON Parsing",
      name: "Malformed JSON payload rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Empty body
  {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: "",
    });
    const res = await checkoutHandler(req);
    recordTest({
      category: "JSON Parsing",
      name: "Empty request body rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // =========================================================================
  // 4. WEBHOOK HMAC SIGNATURE SECURITY
  // =========================================================================
  console.log("\n--- 4. Webhook HMAC Signature Verification ---");

  const dummyWebhookEvent = {
    id: `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "checkout.session.completed",
    data: { object: { metadata: { orderId: "ord_dummy" } } },
  };
  const dummyPayloadStr = JSON.stringify(dummyWebhookEvent);

  // Missing header
  {
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "HMAC Security",
      name: "Missing stripe-signature header rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Forged random hex signature
  {
    const forgedSig = `t=${Math.floor(Date.now() / 1000)},v1=${"deadbeef".repeat(8)}`;
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": forgedSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "HMAC Security",
      name: "Completely forged signature rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Signature signed with wrong secret key
  {
    const wrongSecret = "whsec_wrong_attacker_secret_99999999999999";
    const wrongSig = makeSignature(dummyPayloadStr, wrongSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": wrongSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "HMAC Security",
      name: "Signature signed with wrong secret rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Multiple v1 signatures (Stripe signature rolling support)
  {
    const correctSig = makeSignature(dummyPayloadStr, defaultWebhookSecret);
    const forgedV1 = "deadbeef".repeat(8);
    // Format: t=...,v1=forged,v1=correct
    const multiSig = `${correctSig.split(",")[0]},v1=${forgedV1},${correctSig.split(",")[1]}`;
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": multiSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "HMAC Security",
      name: "Multiple v1 signatures with one valid matches correctly (Stripe key rolling)",
      passed: res.status === 200,
      expected: "HTTP 200 (at least one valid v1 matches)",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Malformed signature: non-hex characters in v1
  {
    const nonHexSig = `t=${Math.floor(Date.now() / 1000)},v1=not_hex_characters_zzzzzzzzzzzzzzzzzzzzzz`;
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": nonHexSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "HMAC Security",
      name: "Non-hex characters in v1 signature rejected with 400 without crashing",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // =========================================================================
  // 5. WEBHOOK REPLAY ATTACK DEFENSE (>300s)
  // =========================================================================
  console.log("\n--- 5. Webhook Replay Attack Defense ---");

  const nowSec = Math.floor(Date.now() / 1000);

  // Expired: 301 seconds ago
  {
    const pastSig = makeSignature(dummyPayloadStr, defaultWebhookSecret, nowSec - 301);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": pastSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Replay Attack Defense",
      name: "Replay with timestamp expired by 301s rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400 (expired timestamp)",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Expired: 1 day ago (86,400s)
  {
    const dayAgoSig = makeSignature(dummyPayloadStr, defaultWebhookSecret, nowSec - 86400);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": dayAgoSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Replay Attack Defense",
      name: "Replay with timestamp 1 day old rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Future timestamp: +305 seconds ahead
  {
    const futureSig = makeSignature(dummyPayloadStr, defaultWebhookSecret, nowSec + 305);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": futureSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Replay Attack Defense",
      name: "Future timestamp +305s rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400 (clock drift tolerance exceeded)",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Near boundary timestamp: 290s ago (within 300s window) -> should be valid
  {
    const validPastEvent = {
      id: `evt_valid_past_${Date.now()}`,
      type: "customer.created",
      data: { object: {} },
    };
    const validPastPayload = JSON.stringify(validPastEvent);
    const validPastSig = makeSignature(validPastPayload, defaultWebhookSecret, nowSec - 290);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": validPastSig },
      body: validPastPayload,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Replay Attack Defense",
      name: "Timestamp within tolerance (290s ago) accepted with 200",
      passed: res.status === 200,
      expected: "HTTP 200",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Non-numeric timestamp
  {
    const badTsSig = `t=invalid_timestamp_abc,v1=${"00".repeat(32)}`;
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": badTsSig },
      body: dummyPayloadStr,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Replay Attack Defense",
      name: "Non-numeric timestamp string rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // =========================================================================
  // 6. WEBHOOK CORRUPTED JSON & EVENT STRUCTURE
  // =========================================================================
  console.log("\n--- 6. Webhook Corrupted Payloads & Event Structure ---");

  // Corrupted / truncated JSON with valid HMAC on the corrupted text
  {
    const truncatedBody = '{"id": "evt_123", "type": "checkout.session.completed", "data": {';
    const sig = makeSignature(truncatedBody, defaultWebhookSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: truncatedBody,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Corrupted Payload",
      name: "Truncated JSON payload with matching signature rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400 (Invalid JSON payload)",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Non-object JSON: array
  {
    const arrayBody = JSON.stringify([1, 2, 3]);
    const sig = makeSignature(arrayBody, defaultWebhookSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: arrayBody,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Corrupted Payload",
      name: "Array JSON payload rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Missing event.id
  {
    const missingIdBody = JSON.stringify({ type: "checkout.session.completed", data: {} });
    const sig = makeSignature(missingIdBody, defaultWebhookSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: missingIdBody,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Corrupted Payload",
      name: "Event missing 'id' property rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Missing event.type
  {
    const missingTypeBody = JSON.stringify({ id: "evt_no_type_123", data: {} });
    const sig = makeSignature(missingTypeBody, defaultWebhookSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: missingTypeBody,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Corrupted Payload",
      name: "Event missing 'type' property rejected with 400",
      passed: res.status === 400,
      expected: "HTTP 400",
      actual: `HTTP ${res.status}`,
      severity: "MEDIUM",
    });
  }

  // Unhandled / unknown event type (e.g. invoice.paid, customer.updated)
  {
    const unknownEvent = {
      id: `evt_unknown_${Date.now()}`,
      type: "charge.dispute.created",
      data: { object: {} },
    };
    const unknownBody = JSON.stringify(unknownEvent);
    const sig = makeSignature(unknownBody, defaultWebhookSecret);
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: unknownBody,
    });
    const res = await webhookHandler(req);
    recordTest({
      category: "Event Type Handling",
      name: "Unknown event type acknowledged with 200 and ignored",
      passed: res.status === 200,
      expected: "HTTP 200",
      actual: `HTTP ${res.status}`,
      severity: "LOW",
    });
  }

  // =========================================================================
  // 7. WEBHOOK IDEMPOTENCY & STATE MACHINE DEFENSE
  // =========================================================================
  console.log("\n--- 7. Webhook Idempotency & State Machine Defense ---");

  // Create an order for state machine testing
  const orderId = `ord_stress_${Date.now()}`;
  await createOrder({
    id: orderId,
    customerEmail: "challenger@example.com",
    frameSize: "16x20",
    palette: "midnight_gold",
    audioPath: "storage/uploads/test.wav",
    totalAmount: 9900,
    status: "pending_payment",
  });

  const eventId = `evt_idem_${Date.now()}`;
  const sessionCompletedEvent = {
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${orderId}`,
        customer_details: { email: "challenger@example.com", name: "Challenger 2" },
        shipping_details: {
          name: "Challenger 2",
          address: {
            line1: "123 Defense Way",
            city: "Austin",
            state: "TX",
            postal_code: "78701",
            country: "US",
          },
        },
        metadata: { orderId: orderId },
      },
    },
  };
  const eventPayload = JSON.stringify(sessionCompletedEvent);
  const validEventSig = makeSignature(eventPayload, defaultWebhookSecret);

  // 1st delivery: process event
  const firstReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": validEventSig },
    body: eventPayload,
  });
  const firstRes = await webhookHandler(firstReq);
  const firstData = await firstRes.json();
  recordTest({
    category: "Idempotency",
    name: "First delivery of checkout.session.completed processes with 200",
    passed: firstRes.status === 200 && firstData.status === "processed",
    expected: "HTTP 200, status: 'processed'",
    actual: `HTTP ${firstRes.status}, status: '${firstData.status}'`,
    severity: "CRITICAL",
  });

  // Verify order transitioned to pending_fulfillment
  const orderAfterFirst = await getOrderById(orderId);
  recordTest({
    category: "State Transition",
    name: "Order status transitioned to pending_fulfillment",
    passed: orderAfterFirst?.status === "pending_fulfillment",
    expected: "status: 'pending_fulfillment'",
    actual: `status: '${orderAfterFirst?.status}'`,
    severity: "CRITICAL",
  });

  // 2nd delivery (sequential duplicate): must return 200 duplicate_ignored
  const secondReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": validEventSig },
    body: eventPayload,
  });
  const secondRes = await webhookHandler(secondReq);
  const secondData = await secondRes.json();
  recordTest({
    category: "Idempotency",
    name: "Sequential duplicate delivery returns 200 and duplicate_ignored",
    passed: secondRes.status === 200 && secondData.status === "duplicate_ignored",
    expected: "HTTP 200, status: 'duplicate_ignored'",
    actual: `HTTP ${secondRes.status}, status: '${secondData.status}'`,
    severity: "HIGH",
  });

  // Concurrent duplicate delivery (burst of 5 identical webhook deliveries simultaneously)
  const burstEventId = `evt_burst_${Date.now()}`;
  const burstEvent = {
    ...sessionCompletedEvent,
    id: burstEventId,
  };
  const burstPayload = JSON.stringify(burstEvent);
  const burstSig = makeSignature(burstPayload, defaultWebhookSecret);

  const burstPromises = Array.from({ length: 5 }).map(() =>
    webhookHandler(
      new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": burstSig },
        body: burstPayload,
      })
    )
  );

  const burstResults = await Promise.all(burstPromises);
  const burstStatuses = burstResults.map((r) => r.status);
  const all200 = burstStatuses.every((s) => s === 200);

  recordTest({
    category: "Concurrency & Idempotency",
    name: "5 concurrent duplicate webhook deliveries all return 200 without DB lock crash",
    passed: all200,
    expected: "All 5 requests return HTTP 200",
    actual: `Statuses: [${burstStatuses.join(", ")}]`,
    severity: "HIGH",
  });

  // State Machine Defense: Do NOT regress order if already shipped or delivered
  for (const terminalStatus of ["shipped", "delivered", "fulfillment_submitted"] as const) {
    const termOrderId = `ord_term_${terminalStatus}_${Date.now()}`;
    await createOrder({
      id: termOrderId,
      customerEmail: "customer@example.com",
      frameSize: "11x14",
      palette: "white_silver",
      audioPath: "storage/uploads/test.wav",
      totalAmount: 6900,
      status: terminalStatus,
    });

    const termEventId = `evt_term_${terminalStatus}_${Date.now()}`;
    const termEvent = {
      id: termEventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${termOrderId}`,
          metadata: { orderId: termOrderId },
        },
      },
    };
    const termPayload = JSON.stringify(termEvent);
    const termSig = makeSignature(termPayload, defaultWebhookSecret);

    const termReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": termSig },
      body: termPayload,
    });
    await webhookHandler(termReq);

    const checkOrder = await getOrderById(termOrderId);
    recordTest({
      category: "State Machine Regression Guard",
      name: `Order in status '${terminalStatus}' does NOT regress to pending_fulfillment`,
      passed: checkOrder?.status === terminalStatus,
      expected: `status remains '${terminalStatus}'`,
      actual: `status is '${checkOrder?.status}'`,
      severity: "CRITICAL",
      details: checkOrder?.status !== terminalStatus ? `Order regressed from '${terminalStatus}' to '${checkOrder?.status}'!` : undefined,
    });
  }

  // =========================================================================
  // 8. ORDER STATUS ROUTE (GET /api/orders/[id])
  // =========================================================================
  console.log("\n--- 8. Order Status Route (/api/orders/[id]) ---");

  // Non-existent ID -> 404
  {
    const req = new NextRequest("http://localhost:3000/api/orders/ord_nonexistent_999999");
    const ctx = { params: Promise.resolve({ id: "ord_nonexistent_999999" }) };
    const res = await orderHandler(req, ctx);
    recordTest({
      category: "Order Query",
      name: "Non-existent order ID returns 404",
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Path traversal in order ID -> 404 (safe)
  const pathTraversalIds = [
    "../../package.json",
    "..%2F..%2Fpackage.json",
    "..\\..\\..\\windows\\system.ini",
    "....//....//etc/passwd",
  ];
  for (const ptId of pathTraversalIds) {
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(ptId)}`);
    const ctx = { params: Promise.resolve({ id: ptId }) };
    const res = await orderHandler(req, ctx);
    recordTest({
      category: "Order Query Path Traversal",
      name: `Path traversal ID '${ptId}' safely returns 404 without crashing`,
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // SQL injection payload in order ID -> 404 (safe)
  const sqliIds = ["' OR '1'='1", "ord_1'; DROP TABLE \"Order\"; --", "1 UNION SELECT * FROM \"Order\""];
  for (const sqli of sqliIds) {
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(sqli)}`);
    const ctx = { params: Promise.resolve({ id: sqli }) };
    const res = await orderHandler(req, ctx);
    recordTest({
      category: "Order Query SQL Injection",
      name: `SQL injection payload '${sqli}' safely returns 404`,
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "CRITICAL",
    });
  }

  // Unpaired Unicode surrogate in order ID -> safe handling
  {
    const surrogateId = "ord_\uD800\uD800_test";
    let crashed = false;
    let status = 0;
    try {
      const req = new NextRequest("http://localhost:3000/api/orders/surrogate_test");
      const ctx = { params: Promise.resolve({ id: surrogateId }) };
      const res = await orderHandler(req, ctx);
      status = res.status;
    } catch {
      crashed = true;
    }
    recordTest({
      category: "Order Query Surrogate Safety",
      name: "Unpaired surrogate in order ID does not crash query route",
      passed: !crashed && status === 404,
      expected: "HTTP 404 (safe lookup, no crash)",
      actual: crashed ? "Crashed" : `HTTP ${status}`,
      severity: "HIGH",
    });
  }

  // All 7 order lifecycle states & status labels
  const lifecycleStates = [
    { state: "pending_payment", expectedLabel: "Pending Payment" },
    { state: "pending_fulfillment", expectedLabel: "Payment Confirmed" },
    { state: "fulfillment_submitted", expectedLabel: "Print Submitted" },
    { state: "shipped", expectedLabel: "Shipped" },
    { state: "delivered", expectedLabel: "Delivered" },
    { state: "payment_failed", expectedLabel: "Payment Failed" },
    { state: "cancelled", expectedLabel: "Cancelled" },
  ];

  for (const item of lifecycleStates) {
    const stateOrderId = `ord_state_${item.state}_${Date.now()}`;
    await createOrder({
      id: stateOrderId,
      customerEmail: "test@example.com",
      shippingName: "Private Person",
      shippingAddress: "Secret Address 123",
      stripeSessionId: `cs_${stateOrderId}`,
      frameSize: "16x20",
      palette: "midnight_gold",
      audioPath: "storage/uploads/test.wav",
      totalAmount: 9900,
      status: item.state as any,
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${stateOrderId}`);
    const ctx = { params: Promise.resolve({ id: stateOrderId }) };
    const res = await orderHandler(req, ctx);
    const data = await res.json();

    recordTest({
      category: "Order Query Lifecycle",
      name: `Order in '${item.state}' returns correct statusLabel '${item.expectedLabel}'`,
      passed: res.status === 200 && data.statusLabel === item.expectedLabel,
      expected: `statusLabel: '${item.expectedLabel}'`,
      actual: `statusLabel: '${data.statusLabel}'`,
      severity: "MEDIUM",
    });

    // PII privacy leak check: customerEmail, shippingName, shippingAddress, stripeSessionId
    const leaksEmail = Boolean(data.customerEmail);
    const leaksAddress = Boolean(data.shippingAddress);
    const leaksName = Boolean(data.shippingName);
    const leaksSession = Boolean(data.stripeSessionId);
    const noPiiLeaks = !leaksEmail && !leaksAddress && !leaksName && !leaksSession;

    recordTest({
      category: "PII Privacy Protection",
      name: `Order query DTO does NOT expose customer PII or Stripe session ID for '${item.state}'`,
      passed: noPiiLeaks,
      expected: "No email, address, name, or stripeSessionId in public JSON",
      actual: `leaks: email=${leaksEmail}, addr=${leaksAddress}, name=${leaksName}, session=${leaksSession}`,
      severity: "HIGH",
      details: !noPiiLeaks ? "Sensitive customer PII exposed on public /api/orders/[id]!" : undefined,
    });
  }

  // =========================================================================
  // 9. PREVIEW ROUTE (GET /api/orders/[id]/preview)
  // =========================================================================
  console.log("\n--- 9. Preview Route (/api/orders/[id]/preview) ---");

  // Non-existent order -> 404
  {
    const req = new NextRequest("http://localhost:3000/api/orders/ord_ghost_preview/preview");
    const ctx = { params: Promise.resolve({ id: "ord_ghost_preview" }) };
    const res = await previewHandler(req, ctx);
    recordTest({
      category: "Preview Route",
      name: "Non-existent order preview returns 404",
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Path traversal in preview route ID -> 404
  for (const ptId of ["../../package.json", "..%2F..%2Fstorage%2Fsoundwave.db"]) {
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(ptId)}/preview`);
    const ctx = { params: Promise.resolve({ id: ptId }) };
    const res = await previewHandler(req, ctx);
    recordTest({
      category: "Preview Path Traversal",
      name: `Path traversal ID '${ptId}' in preview route returns 404`,
      passed: res.status === 404,
      expected: "HTTP 404",
      actual: `HTTP ${res.status}`,
      severity: "HIGH",
    });
  }

  // Poisoned DB order with external path in previewUrl
  {
    const poisonedOrderId = `ord_poison_${Date.now()}`;
    await createOrder({
      id: poisonedOrderId,
      customerEmail: "attacker@example.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/test.wav",
      previewUrl: "../../package.json", // Poisoned path attempting traversal outside storage/previews
      totalAmount: 4900,
      status: "pending_payment",
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${poisonedOrderId}/preview`);
    const ctx = { params: Promise.resolve({ id: poisonedOrderId }) };
    const res = await previewHandler(req, ctx);
    const bodyText = await res.text();

    // Must NOT serve package.json contents! Should fall back to SVG
    const leakedPackageJson = bodyText.includes('"name": "soundwave-store"');
    recordTest({
      category: "Preview Path Traversal Defense",
      name: "Poisoned order.previewUrl ('../../package.json') does NOT leak arbitrary files",
      passed: !leakedPackageJson,
      expected: "Path traversal blocked (package.json contents not returned)",
      actual: leakedPackageJson ? "Arbitrary file leaked!" : "Blocked, fallback SVG rendered",
      severity: "CRITICAL",
      details: leakedPackageJson ? "VULNERABILITY: Arbitrary local file disclosure through order.previewUrl!" : undefined,
    });
  }

  // Fallback SVG XSS Injection Defense
  {
    const xssOrderId = `ord_xss_${Date.now()}`;
    const maliciousCaption = '<script>alert("XSS")</script>" onmouseover="alert(1)';
    const maliciousPalette = '<img src=x onerror=alert(1)>';
    await createOrder({
      id: xssOrderId,
      customerEmail: "xss@example.com",
      frameSize: "8x10",
      palette: maliciousPalette,
      caption: maliciousCaption,
      audioPath: "storage/uploads/test.wav",
      totalAmount: 4900,
      status: "pending_payment",
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${xssOrderId}/preview`);
    const ctx = { params: Promise.resolve({ id: xssOrderId }) };
    const res = await previewHandler(req, ctx);
    const svgText = await res.text();
    const contentType = res.headers.get("Content-Type");
    const csp = res.headers.get("Content-Security-Policy");

    const containsRawScriptTag = svgText.includes("<script>") || svgText.includes("<img src=x");
    const properlyEscaped = svgText.includes("&lt;script&gt;") || svgText.includes("&lt;img");
    const hasStrictCsp = csp?.includes("default-src 'none'") ?? false;

    recordTest({
      category: "Preview SVG XSS Defense",
      name: "Malicious HTML/script tags in caption and palette are XML-escaped in SVG preview",
      passed: !containsRawScriptTag && properlyEscaped,
      expected: "Raw tags escaped (&lt;script&gt;), no unescaped injection",
      actual: containsRawScriptTag ? "Contains raw unescaped script tag!" : "Properly escaped",
      severity: "CRITICAL",
    });

    recordTest({
      category: "Preview SVG Security Headers",
      name: "SVG preview response contains strict Content-Security-Policy and nosniff",
      passed: hasStrictCsp && res.headers.get("X-Content-Type-Options") === "nosniff",
      expected: "CSP default-src 'none' and X-Content-Type-Options: nosniff present",
      actual: `CSP: '${csp}', X-Content-Type-Options: '${res.headers.get("X-Content-Type-Options")}'`,
      severity: "HIGH",
    });
  }

  // Legitimate file serving on disk
  {
    const previewDir = path.resolve(process.cwd(), "storage", "previews");
    await fs.mkdir(previewDir, { recursive: true });
    const legitOrderId = `ord_legit_disk_${Date.now()}`;
    const testJpgPath = path.join(previewDir, `${legitOrderId}_preview.jpg`);
    const dummyJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    await fs.writeFile(testJpgPath, dummyJpgHeader);

    await createOrder({
      id: legitOrderId,
      customerEmail: "disk@example.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      audioPath: "storage/uploads/test.wav",
      totalAmount: 9900,
      status: "fulfillment_submitted",
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${legitOrderId}/preview`);
    const ctx = { params: Promise.resolve({ id: legitOrderId }) };
    const res = await previewHandler(req, ctx);
    const contentType = res.headers.get("Content-Type");

    recordTest({
      category: "Preview File Serving",
      name: "Existing preview image file on disk is returned with image/jpeg Content-Type",
      passed: res.status === 200 && contentType === "image/jpeg",
      expected: "HTTP 200, Content-Type: image/jpeg",
      actual: `HTTP ${res.status}, Content-Type: ${contentType}`,
      severity: "HIGH",
    });

    // Cleanup disk test file
    await fs.unlink(testJpgPath).catch(() => {});
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n================================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const criticalFails = results.filter((r) => !r.passed && r.severity === "CRITICAL").length;
  const highFails = results.filter((r) => !r.passed && r.severity === "HIGH").length;

  console.log(`TOTAL TESTS:     ${total}`);
  console.log(`PASSED:          ${passedCount}`);
  console.log(`FAILED:          ${failedCount}`);
  console.log(`CRITICAL FAILS:  ${criticalFails}`);
  console.log(`HIGH FAILS:      ${highFails}`);
  console.log("================================================================");

  if (failedCount > 0) {
    console.log("\nFAILED TESTS LIST:");
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`- [${f.severity}] [${f.category}] ${f.name}`);
      console.log(`    Expected: ${f.expected}`);
      console.log(`    Actual:   ${f.actual}`);
      if (f.details) console.log(`    Details:  ${f.details}`);
    }
  }

  // Write JSON artifact of results for auditability
  const jsonReportPath = path.resolve(process.cwd(), "tests", "challenger2_results.json");
  await fs.writeFile(jsonReportPath, JSON.stringify({ total, passedCount, failedCount, results }, null, 2));

  return { total, passedCount, failedCount, criticalFails, highFails };
}

runEmpiricalStressSuite()
  .then(({ failedCount }) => {
    process.exit(failedCount > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("FATAL ERROR IN STRESS SUITE:", err);
    process.exit(2);
  });
