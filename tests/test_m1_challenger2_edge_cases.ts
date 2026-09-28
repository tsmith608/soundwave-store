/**
 * SoundWave Art — Milestone 1 Challenger 2 Edge Cases & Route Handler Test Suite
 * Tests live Supabase PostgreSQL environment for:
 * 1. Route Handlers: /api/checkout, /api/orders/[id], /api/upload, /api/webhooks/stripe
 * 2. Edge cases: Malformed IDs, unexpected nulls, long strings in caption & shipping fields
 * 3. Unicode fidelity, SQL injection resilience, and PostgreSQL persistence
 */

import { POST as checkoutHandler } from "@/app/api/checkout/route";
import { GET as orderHandler } from "@/app/api/orders/[id]/route";
import { POST as uploadHandler } from "@/app/api/upload/route";
import { POST as webhookHandler } from "@/app/api/webhooks/stripe/route";
import {
  createOrder,
  getOrderById,
  updateOrderStatus,
  prisma,
  ensurePragmas,
  recordWebhookEvent,
  isWebhookProcessed,
} from "@/lib/db";
import { NextRequest } from "next/server";
import crypto from "crypto";

interface EdgeCaseResult {
  category: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const testResults: EdgeCaseResult[] = [];

function record(res: EdgeCaseResult) {
  testResults.push(res);
  const tag = res.passed ? "[PASS]" : "[FAIL]";
  console.log(`  ${tag} [${res.category}] ${res.name}`);
  if (!res.passed) {
    console.log(`         Expected: ${res.expected}`);
    console.log(`         Actual:   ${res.actual}`);
    if (res.details) console.log(`         Details:  ${res.details}`);
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

async function runEdgeCaseTests() {
  await ensurePragmas();
  console.log("================================================================");
  console.log("   SOUNDWAVE ART — CHALLENGER M1_2 EDGE CASES & ROUTE TESTS");
  console.log("================================================================\n");

  const runPrefix = `m1_edge_${Date.now()}`;

  // -------------------------------------------------------------------------
  // 1. ROUTE HANDLER: /api/upload
  // -------------------------------------------------------------------------
  console.log("--- 1. Route Handler: /api/upload ---");

  // 1.1 Valid WAV upload via FormData
  {
    const wavBuffer = Buffer.alloc(44);
    wavBuffer.write("RIFF", 0, "ascii");
    wavBuffer.writeUInt32LE(36, 4);
    wavBuffer.write("WAVE", 8, "ascii");
    wavBuffer.write("fmt ", 12, "ascii");
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // Mono
    wavBuffer.writeUInt32LE(44100, 24); // Sample rate
    wavBuffer.writeUInt32LE(88200, 28); // Byte rate
    wavBuffer.writeUInt16LE(2, 32);
    wavBuffer.writeUInt16LE(16, 34);
    wavBuffer.write("data", 36, "ascii");
    wavBuffer.writeUInt32LE(0, 40);

    const formData = new FormData();
    formData.append("audio", new Blob([wavBuffer], { type: "audio/wav" }), "test_audio.wav");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const res = await uploadHandler(req);
    const json = await res.json();

    record({
      category: "Upload Route",
      name: "Valid WAV audio upload returns 200 with audioId and audioPath",
      passed: res.status === 200 && json.success === true && Boolean(json.audioId) && json.audioPath.startsWith("storage/uploads/"),
      expected: "HTTP 200, success: true, audioId populated",
      actual: `HTTP ${res.status}, success: ${json.success}, audioId: ${json.audioId}, audioPath: ${json.audioPath}`,
    });
  }

  // 1.2 Valid JPEG photo upload via FormData
  {
    // Minimal 1x1 JPEG bytes
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x80, 0xff, 0xd9,
    ]);

    const formData = new FormData();
    formData.append("photo", new Blob([jpegBuffer], { type: "image/jpeg" }), "wedding_photo.jpg");

    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const res = await uploadHandler(req);
    const json = await res.json();

    record({
      category: "Upload Route",
      name: "Valid JPEG image upload returns 200 with photoId and photoPath",
      passed: res.status === 200 && json.success === true && Boolean(json.photoId) && json.format === "jpeg",
      expected: "HTTP 200, success: true, format: 'jpeg'",
      actual: `HTTP ${res.status}, success: ${json.success}, photoId: ${json.photoId}, format: ${json.format}`,
    });
  }

  // 1.3 Empty / missing file in FormData returns 400
  {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const res = await uploadHandler(req);
    const json = await res.json();

    record({
      category: "Upload Route",
      name: "Missing upload file returns 400",
      passed: res.status === 400 && json.success === false,
      expected: "HTTP 400, success: false",
      actual: `HTTP ${res.status}, success: ${json.success}, error: ${json.error}`,
    });
  }

  // -------------------------------------------------------------------------
  // 2. ROUTE HANDLER: /api/checkout WITH UNEXPECTED NULLS & POSTGRESQL INSERT
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Route Handler: /api/checkout Unexpected Nulls & PostgreSQL Persistence ---");

  // 2.1 Checkout with all optional fields explicitly NULL
  {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "16x20",
        palette: null,
        caption: null,
        customerEmail: null,
        shippingName: null,
        shippingAddress: null,
        audioId: null,
        photoId: null,
        photoPath: null,
        decorativeTheme: null,
      }),
    });
    const res = await checkoutHandler(req);
    const json = await res.json();

    let dbSavedCorrectly = false;
    let savedOrder: any = null;
    if (json.orderId) {
      savedOrder = await getOrderById(json.orderId);
      dbSavedCorrectly =
        savedOrder !== null &&
        savedOrder.frameSize === "16x20" &&
        savedOrder.palette === "midnight_gold" && // default fallback
        savedOrder.customerEmail === "customer@example.com" && // default fallback
        savedOrder.decorativeTheme === "botanical" && // default fallback
        savedOrder.caption === null &&
        savedOrder.shippingName === null &&
        savedOrder.shippingAddress === null &&
        savedOrder.photoPath === null;
    }

    record({
      category: "Checkout Nulls",
      name: "Checkout with all optional fields explicitly NULL creates PostgreSQL order safely",
      passed: res.status === 200 && json.success === true && dbSavedCorrectly,
      expected: "HTTP 200, order created in Supabase PostgreSQL with null optional columns",
      actual: `HTTP ${res.status}, orderId: ${json.orderId}, dbSaved: ${dbSavedCorrectly}`,
    });
  }

  // 2.2 Checkout with empty JSON object {} (missing frameSize)
  {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await checkoutHandler(req);
    const json = await res.json();

    record({
      category: "Checkout Nulls",
      name: "Empty JSON body {} returns 400 due to missing frameSize",
      passed: res.status === 400 && Boolean(json.error?.includes("Invalid frame size")),
      expected: "HTTP 400, error mentions invalid frame size",
      actual: `HTTP ${res.status}, error: ${json.error}`,
    });
  }

  // 2.3 Checkout with invalid JSON syntax
  {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: "{ not_valid_json: 123",
    });
    const res = await checkoutHandler(req);
    const json = await res.json();

    record({
      category: "Checkout JSON",
      name: "Malformed JSON returns 400 'Invalid JSON body'",
      passed: res.status === 400 && json.error === "Invalid JSON body",
      expected: "HTTP 400, error: 'Invalid JSON body'",
      actual: `HTTP ${res.status}, error: ${json.error}`,
    });
  }

  // -------------------------------------------------------------------------
  // 3. LONG STRINGS IN CAPTION & SHIPPING FIELDS (POSTGRESQL BEHAVIOR)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Long Strings & Boundaries in Caption and Shipping Fields ---");

  // 3.1 Caption boundary: 200 chars allowed, 201 chars rejected
  {
    const req200 = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "8x10",
        caption: "A".repeat(200),
      }),
    });
    const res200 = await checkoutHandler(req200);

    const req201 = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "8x10",
        caption: "A".repeat(201),
      }),
    });
    const res201 = await checkoutHandler(req201);
    const json201 = await res201.json();

    record({
      category: "Long Strings - Caption",
      name: "Caption max length 200 chars strictly enforced (200 passes, 201 fails)",
      passed: res200.status === 200 && res201.status === 400 && json201.error.includes("exceeds maximum length of 200 characters"),
      expected: "200 chars -> HTTP 200; 201 chars -> HTTP 400",
      actual: `200 chars -> HTTP ${res200.status}; 201 chars -> HTTP ${res201.status}, error: ${json201.error}`,
    });
  }

  // 3.2 Long shippingAddress (5,000 characters) in checkout & PostgreSQL persistence
  {
    const longAddress = "123 Symphony Road, Apt 4B, " + "Extended Delivery Instructions: Please leave near gate. ".repeat(80);
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "16x20",
        palette: "midnight_gold",
        customerEmail: "longaddr@example.com",
        shippingName: "Long Address Recipient",
        shippingAddress: longAddress,
      }),
    });
    const res = await checkoutHandler(req);
    const json = await res.json();

    let addrMatch = false;
    let storedLength = 0;
    if (json.orderId) {
      const order = await getOrderById(json.orderId);
      addrMatch = order?.shippingAddress === longAddress;
      storedLength = order?.shippingAddress?.length ?? 0;
    }

    record({
      category: "Long Strings - Shipping",
      name: `Long shippingAddress (${longAddress.length} chars) safely stored in PostgreSQL without truncation`,
      passed: res.status === 200 && addrMatch,
      expected: `HTTP 200, stored exactly ${longAddress.length} characters in PostgreSQL`,
      actual: `HTTP ${res.status}, stored length: ${storedLength}`,
    });
  }

  // 3.3 Long shippingName (2,000 characters) in checkout & PostgreSQL persistence
  {
    const longName = "Dr. " + "Alexander ".repeat(150) + "The Great III";
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        frameSize: "11x14",
        palette: "ocean_navy",
        shippingName: longName,
        shippingAddress: "456 King St, Austin, TX 78701",
      }),
    });
    const res = await checkoutHandler(req);
    const json = await res.json();

    let nameMatch = false;
    let storedLen = 0;
    if (json.orderId) {
      const order = await getOrderById(json.orderId);
      nameMatch = order?.shippingName === longName;
      storedLen = order?.shippingName?.length ?? 0;
    }

    record({
      category: "Long Strings - Shipping",
      name: `Long shippingName (${longName.length} chars) safely stored in PostgreSQL`,
      passed: res.status === 200 && nameMatch,
      expected: `HTTP 200, stored exactly ${longName.length} chars`,
      actual: `HTTP ${res.status}, stored length: ${storedLen}`,
    });
  }

  // 3.4 Multi-byte Unicode & Emojis in caption, shippingName, and shippingAddress
  {
    const unicodeOrderInput = {
      id: `${runPrefix}_unicode_test`,
      customerEmail: "unicode_test@example.com",
      shippingName: "François & Müller-Özdemir 👨‍👩‍👧‍👦",
      shippingAddress: "東京都新宿区西新宿２丁目８−１, 東京都庁, 〒163-8001 日本 🇯🇵",
      frameSize: "16x20",
      palette: "midnight_gold",
      caption: "Our First Dance 🎶 — September 20, 2025 💍✨ (Café des Âmes Égarées)",
      audioPath: "storage/uploads/test.wav",
      totalAmount: 9900,
    };

    const created = await createOrder(unicodeOrderInput);
    const fetched = await getOrderById(created.id);

    const nameExact = fetched?.shippingName === unicodeOrderInput.shippingName;
    const addrExact = fetched?.shippingAddress === unicodeOrderInput.shippingAddress;
    const captionExact = fetched?.caption === unicodeOrderInput.caption;

    record({
      category: "Unicode Fidelity",
      name: "Complex multi-byte UTF-8 strings (CJK, French/German diacritics, Emoji surrogates) preserved byte-for-byte in PostgreSQL",
      passed: Boolean(fetched) && nameExact && addrExact && captionExact,
      expected: "Full Unicode fidelity on retrieval from Supabase PostgreSQL",
      actual: `nameMatch: ${nameExact}, addrMatch: ${addrExact}, captionMatch: ${captionExact}`,
    });
  }

  // -------------------------------------------------------------------------
  // 4. MALFORMED IDS & SQL INJECTION AGAINST POSTGRESQL
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Malformed IDs & SQL Injection Resilience ---");

  const attackVectors = [
    { name: "Classic SQLi OR 1=1", id: "' OR '1'='1" },
    { name: "PostgreSQL DROP TABLE attempt", id: "'; DROP TABLE \"Order\" CASCADE; --" },
    { name: "PostgreSQL UNION SELECT injection", id: "1' UNION SELECT 'hacked', 'admin@exploit.com', null, null, '16x20', 'gold', null, 'audio', null, 'botanical', null, null, 'pending', null, null, 0, 'direct', null, null, null, null, null, null, null, null, null, null, null, NOW(), NOW() --" },
    { name: "Path traversal with dot-dot-slash", id: "../../../../../etc/passwd" },
    { name: "Extremely long ID (2,000 chars)", id: "A".repeat(2000) },
    { name: "Null byte injection in ID", id: "order_\x00_malformed" },
    { name: "Non-existent UUID", id: "11111111-2222-3333-4444-555555555555" },
    { name: "Special chars in ID", id: "!@#$%^&*()_+{}[]:;\"'<>?,./~`" },
  ];

  for (const vec of attackVectors) {
    const req = new NextRequest(`http://localhost:3000/api/orders/${encodeURIComponent(vec.id)}`);
    const res = await orderHandler(req, { params: Promise.resolve({ id: vec.id }) });
    const json = await res.json();

    const isNullByteVector = vec.name.includes("Null byte");
    const isSafe = isNullByteVector ? (res.status === 404 || res.status === 500) : (res.status === 404 && json.error === "Order not found");

    record({
      category: "Malformed ID & SQLi",
      name: `GET /api/orders/[id] safely handles vector: ${vec.name}`,
      passed: isSafe,
      expected: isNullByteVector ? "HTTP 404 (or handled 500 under PostgreSQL UTF8 null-byte restriction 22021)" : "HTTP 404, error: 'Order not found'",
      actual: `HTTP ${res.status}, error: ${json.error}`,
      details: isNullByteVector && res.status === 500 ? "PostgreSQL code 22021 (invalid byte sequence 0x00) handled by 500 error boundary" : undefined,
    });
  }

  // Confirm database tables are completely intact after attack vectors
  const tableCheck = await prisma.order.count();
  record({
    category: "Malformed ID & SQLi",
    name: "Supabase PostgreSQL tables remain fully intact and operational after SQLi stress",
    passed: tableCheck >= 0,
    expected: "prisma.order.count() executes successfully",
    actual: `Order row count in PostgreSQL: ${tableCheck}`,
  });

  // -------------------------------------------------------------------------
  // 5. ROUTE HANDLER: /api/webhooks/stripe UNDER POSTGRESQL
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Route Handler: /api/webhooks/stripe Under PostgreSQL ---");

  // Create an order for webhook testing
  const webhookOrderId = `${runPrefix}_wh_order`;
  await createOrder({
    id: webhookOrderId,
    customerEmail: "stripe_wh@example.com",
    shippingName: "Before Webhook Name",
    shippingAddress: "Old Address",
    frameSize: "16x20",
    palette: "midnight_gold",
    audioPath: "storage/uploads/audio.wav",
    totalAmount: 9900,
    status: "pending_payment",
  });

  const whEventId = `evt_${runPrefix}_001`;
  const whPayload = {
    id: whEventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${webhookOrderId}`,
        customer_details: { email: "updated_email@example.com", name: "Updated Customer Name" },
        shipping_details: {
          name: "Updated Shipping Name",
          address: {
            line1: "999 Verified St",
            city: "Portland",
            state: "OR",
            postal_code: "97201",
            country: "US",
          },
        },
        metadata: { orderId: webhookOrderId },
      },
    },
  };

  const whPayloadStr = JSON.stringify(whPayload);
  const whSignature = makeSignature(whPayloadStr);

  // First webhook delivery
  const whReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": whSignature },
    body: whPayloadStr,
  });
  const whRes = await webhookHandler(whReq);
  const whJson = await whRes.json();

  const updatedOrder = await getOrderById(webhookOrderId);
  const webhookEventRow = await prisma.webhookEvent.findUnique({ where: { eventId: whEventId } });

  record({
    category: "Stripe Webhook",
    name: "Valid checkout.session.completed webhook mutates order status to pending_fulfillment in PostgreSQL",
    passed: whRes.status === 200 && whJson.status === "processed" && updatedOrder?.status === "pending_fulfillment",
    expected: "HTTP 200, status: 'processed', order.status: 'pending_fulfillment'",
    actual: `HTTP ${whRes.status}, webhookStatus: ${whJson.status}, orderStatus: ${updatedOrder?.status}`,
  });

  record({
    category: "Stripe Webhook",
    name: "WebhookEvent row written to Supabase PostgreSQL table with status 'processed'",
    passed: webhookEventRow !== null && webhookEventRow.status === "processed",
    expected: "WebhookEvent row found with status 'processed'",
    actual: `WebhookEvent status: ${webhookEventRow?.status}`,
  });

  // Duplicate webhook delivery -> must return duplicate_ignored
  const whDupReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": whSignature },
    body: whPayloadStr,
  });
  const whDupRes = await webhookHandler(whDupReq);
  const whDupJson = await whDupRes.json();

  record({
    category: "Stripe Webhook",
    name: "Duplicate delivery returns duplicate_ignored idempotently from PostgreSQL",
    passed: whDupRes.status === 200 && whDupJson.status === "duplicate_ignored",
    expected: "HTTP 200, status: 'duplicate_ignored'",
    actual: `HTTP ${whDupRes.status}, status: ${whDupJson.status}`,
  });

  // Payment failed event
  const failOrderId = `${runPrefix}_fail_order`;
  await createOrder({
    id: failOrderId,
    customerEmail: "fail_test@example.com",
    frameSize: "8x10",
    palette: "ocean_navy",
    audioPath: "storage/uploads/fail.wav",
    totalAmount: 4900,
    status: "pending_payment",
  });

  const failEventId = `evt_${runPrefix}_fail`;
  const failPayload = {
    id: failEventId,
    type: "payment_intent.payment_failed",
    data: {
      object: {
        metadata: { orderId: failOrderId },
      },
    },
  };
  const failPayloadStr = JSON.stringify(failPayload);
  const failSig = makeSignature(failPayloadStr);

  const failReq = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": failSig },
    body: failPayloadStr,
  });
  const failRes = await webhookHandler(failReq);
  const failedOrder = await getOrderById(failOrderId);

  record({
    category: "Stripe Webhook",
    name: "payment_intent.payment_failed updates order status to payment_failed in PostgreSQL",
    passed: failRes.status === 200 && failedOrder?.status === "payment_failed",
    expected: "HTTP 200, order status updated to payment_failed",
    actual: `HTTP ${failRes.status}, order status: ${failedOrder?.status}`,
  });

  // Clean up synthetic test orders created during this test
  try {
    await prisma.order.deleteMany({
      where: {
        id: {
          in: [webhookOrderId, failOrderId, `${runPrefix}_unicode_test`],
        },
      },
    });
    await prisma.webhookEvent.deleteMany({
      where: {
        eventId: {
          in: [whEventId, failEventId],
        },
      },
    });
  } catch (cleanErr) {
    console.warn("Cleanup error (non-fatal):", cleanErr);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n================================================================");
  console.log("   EDGE CASES & ROUTE HANDLER TEST SUMMARY");
  console.log("================================================================");
  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  console.log(`TOTAL TESTS:     ${total}`);
  console.log(`PASSED:          ${passedCount}`);
  console.log(`FAILED:          ${failedCount}`);
  console.log("================================================================\n");

  if (failedCount > 0) {
    console.error("FAILED TESTS:");
    for (const f of testResults.filter((r) => !r.passed)) {
      console.error(`- [${f.category}] ${f.name}: actual '${f.actual}', expected '${f.expected}'`);
    }
    process.exit(1);
  }
}

runEdgeCaseTests().catch((err) => {
  console.error("Test runner failed unexpectedly:", err);
  process.exit(1);
});
