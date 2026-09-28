/**
 * Functional Verification Script for Milestone 1
 * Tests DB Subsystem, Audio Processing, Upload API, and Order Query API
 */

import {
  prisma,
  createOrder,
  getOrderById,
  getOrderByStripeSessionId,
  updateOrderStatus,
  addFulfillmentLog,
  getFulfillmentLogs,
  recordWebhookEvent,
  isWebhookProcessed,
  getStatusLabel,
} from "./db";
import { validateAudioUpload, detectAudioFormat } from "./audio";
import { POST as uploadHandler } from "@/app/api/upload/route";
import { GET as orderHandler } from "@/app/api/orders/[id]/route";
import { GET as previewHandler } from "@/app/api/orders/[id]/preview/route";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Helper to create a synthetic WAV buffer for testing
function createTestWavBuffer(seconds: number = 2, sampleRate: number = 44100): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * blockAlign;
  const totalSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  // RIFF chunk descriptor
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(totalSize, 4);
  buf.write("WAVE", 8, "ascii");

  // fmt sub-chunk
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buf.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  // Fill sine wave audio data
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t); // 440 Hz A tone
    const intSample = Math.floor(sample * 32767);
    buf.writeInt16LE(intSample, 44 + i * 2);
  }

  return buf;
}

// Helper to create synthetic MP3 buffer (with ID3 header)
function createTestMp3Buffer(sizeBytes: number = 32000): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  // Write ID3 header: 'ID3', version 3, flags 0, size
  buf.write("ID3", 0, "ascii");
  buf[3] = 0x03;
  buf[4] = 0x00;
  buf[5] = 0x00;
  // Size = 100 bytes in syncsafe format
  buf[6] = 0x00;
  buf[7] = 0x00;
  buf[8] = 0x00;
  buf[9] = 0x64;

  // Followed by MPEG sync word 0xFF 0xFB
  buf[110] = 0xff;
  buf[111] = 0xfb;
  buf[112] = 0x90;
  buf[113] = 0x64;

  return buf;
}

// Helper to create synthetic WebM buffer
function createTestWebmBuffer(sizeBytes: number = 16000): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  // EBML Header 0x1A 0x45 0xDF 0xA3
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

// Helper to create synthetic M4A buffer
function createTestM4aBuffer(sizeBytes: number = 16000): Buffer {
  const buf = Buffer.alloc(sizeBytes);
  // ftyp box at offset 4
  buf.writeUInt32BE(sizeBytes, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("M4A ", 8, "ascii");
  return buf;
}

async function runTests() {
  console.log("==================================================");
  console.log("   SOUNDWAVE ART — MILESTONE 1 VERIFICATION");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ""}`);
      failed++;
    }
  }

  // TEST SUITE 1: Audio Validation & Duration Parsing
  console.log("--- 1. Audio Validation & Format Detection ---");
  const wavBuf = createTestWavBuffer(3.5);
  const wavValidation = validateAudioUpload(wavBuf, "wedding_vows.wav", "audio/wav");
  assert(wavValidation.valid, "WAV format validation", `Expected valid=true, got ${wavValidation.valid}`);
  assert(wavValidation.format === "wav", "WAV format detection", `Expected 'wav', got ${wavValidation.format}`);
  assert(wavValidation.durationSeconds! >= 3.0 && wavValidation.durationSeconds! <= 4.0, "WAV duration calculation", `Expected ~3.5s, got ${wavValidation.durationSeconds}`);

  const mp3Buf = createTestMp3Buffer(64000);
  const mp3Validation = validateAudioUpload(mp3Buf, "heartbeat.mp3", "audio/mpeg");
  assert(mp3Validation.valid, "MP3 format validation");
  assert(mp3Validation.format === "mp3", "MP3 format detection");

  const webmBuf = createTestWebmBuffer(32000);
  const webmValidation = validateAudioUpload(webmBuf, "mic_record.webm", "audio/webm");
  assert(webmValidation.valid, "WebM format validation");
  assert(webmValidation.format === "webm", "WebM format detection");

  const m4aBuf = createTestM4aBuffer(32000);
  const m4aValidation = validateAudioUpload(m4aBuf, "song.m4a", "audio/mp4");
  assert(m4aValidation.valid, "M4A format validation");
  assert(m4aValidation.format === "m4a", "M4A format detection");

  const textBuf = Buffer.from("Hello world, this is a plain text file pretending to be audio");
  const textValidation = validateAudioUpload(textBuf, "fake.txt", "text/plain");
  assert(!textValidation.valid, "Rejects unsupported text file");

  // TEST SUITE 2: Database Subsystem & Helpers
  console.log("\n--- 2. Database Subsystem & Prisma Helpers ---");
  const testOrderId = `test_ord_${Date.now()}`;
  const testSessionId = `cs_test_${Date.now()}`;

  const createdOrder = await createOrder({
    id: testOrderId,
    customerEmail: "sarah.jenkins@example.com",
    shippingName: "Sarah Jenkins",
    shippingAddress: "742 Evergreen Terrace, Springfield, OR 97477",
    frameSize: "16x20",
    palette: "midnight_gold",
    caption: "Our First Dance — October 14, 2024",
    audioPath: "storage/uploads/test_audio.wav",
    previewUrl: "/api/orders/" + testOrderId + "/preview",
    totalAmount: 9900,
    stripeSessionId: testSessionId,
  });

  assert(createdOrder.id === testOrderId, "Prisma Order creation");
  assert(createdOrder.status === "pending_payment", "Default status is pending_payment");
  assert(createdOrder.totalAmount === 9900, "Order totalAmount is 9900 cents ($99)");

  const fetchedOrder = await getOrderById(testOrderId);
  assert(fetchedOrder !== null && fetchedOrder.customerEmail === "sarah.jenkins@example.com", "Query getOrderById");

  const fetchedBySession = await getOrderByStripeSessionId(testSessionId);
  assert(fetchedBySession !== null && fetchedBySession.id === testOrderId, "Query getOrderByStripeSessionId");

  const updatedOrder = await updateOrderStatus(testOrderId, "pending_fulfillment", {
    partnerOrderId: "prodigi_test_8812",
  });
  assert(updatedOrder.status === "pending_fulfillment", "Update order status to pending_fulfillment");
  assert(updatedOrder.partnerOrderId === "prodigi_test_8812", "Update order partnerOrderId");

  await addFulfillmentLog(testOrderId, "pdf_generation", "success", "Generated 300 DPI PDF (2.4MB)");
  await addFulfillmentLog(testOrderId, "partner_submission", "success", "Submitted to Prodigi");

  const logs = await getFulfillmentLogs(testOrderId);
  assert(logs.length === 2, "Fulfillment logs count", `Expected 2, got ${logs.length}`);
  assert(logs[0].step === "pdf_generation", "Fulfillment log step verified");

  // Webhook idempotency test
  const testEventId = `evt_test_${Date.now()}`;
  assert(!(await isWebhookProcessed(testEventId)), "Webhook initially not processed");

  await recordWebhookEvent(testEventId, "checkout.session.completed", "processed", {
    orderId: testOrderId,
    amount: 9900,
  });

  assert(await isWebhookProcessed(testEventId), "Webhook recorded and marked processed");

  // Duplicate webhook event check
  const duplicateRecord = await recordWebhookEvent(testEventId, "checkout.session.completed", "processed", {
    orderId: testOrderId,
    amount: 9900,
  });
  assert(duplicateRecord.eventId === testEventId, "Idempotent duplicate webhook upsert succeeded");

  // TEST SUITE 3: POST /api/upload Route
  console.log("\n--- 3. Audio Upload API (POST /api/upload) ---");
  const testUploadWav = createTestWavBuffer(2.0);
  const formData = new FormData();
  const fileBlob = new Blob([new Uint8Array(testUploadWav)], { type: "audio/wav" });
  formData.append("audio", fileBlob, "recording_sample.wav");

  const uploadRequest = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: formData,
  });

  const uploadResponse = await uploadHandler(uploadRequest);
  assert(uploadResponse.status === 200, "POST /api/upload HTTP 200");
  const uploadJson = await uploadResponse.json();
  assert(uploadJson.success === true, "Upload response success flag");
  assert(typeof uploadJson.audioId === "string" && uploadJson.audioId.startsWith("aud_"), "audioId format");
  assert(typeof uploadJson.audioPath === "string" && uploadJson.audioPath.startsWith("storage/uploads/"), "audioPath format");
  assert(uploadJson.durationSeconds >= 1.9, "Audio duration reported correctly");

  // Verify file was physically written to disk in storage/uploads/
  const diskPath = path.resolve(process.cwd(), uploadJson.audioPath);
  const fileStat = await fs.stat(diskPath);
  assert(fileStat.size === testUploadWav.length, "Audio file physically persisted to disk with correct byte size");

  // Test invalid upload rejection
  const invalidFormData = new FormData();
  const badBlob = new Blob(["not audio content"], { type: "text/plain" });
  invalidFormData.append("audio", badBlob, "not_audio.txt");
  const badRequest = new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: invalidFormData,
  });
  const badResponse = await uploadHandler(badRequest);
  assert(badResponse.status === 400, "POST /api/upload rejects invalid file with HTTP 400");

  // TEST SUITE 4: GET /api/orders/[id] Route
  console.log("\n--- 4. Order Query API (GET /api/orders/[id]) ---");
  const orderRequest = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}`);
  const orderContext = { params: Promise.resolve({ id: testOrderId }) };
  const orderResponse = await orderHandler(orderRequest, orderContext);
  assert(orderResponse.status === 200, "GET /api/orders/[id] HTTP 200");
  const orderJson = await orderResponse.json();
  assert(orderJson.id === testOrderId, "Sanitized order id matches");
  assert(orderJson.status === "pending_fulfillment", "Sanitized status matches");
  assert(orderJson.statusLabel === "Payment Confirmed", "Sanitized statusLabel matches");
  assert(orderJson.frameSize === "16x20", "frameSize matches");
  assert(orderJson.palette === "midnight_gold", "palette matches");
  assert(orderJson.caption === "Our First Dance — October 14, 2024", "caption matches");
  assert(orderJson.partnerOrderId === "prodigi_test_8812", "partnerOrderId matches");

  // Test 404 for non-existent order
  const nonExistentRequest = new NextRequest("http://localhost:3000/api/orders/ord_does_not_exist");
  const nonExistentContext = { params: Promise.resolve({ id: "ord_does_not_exist" }) };
  const notFoundResponse = await orderHandler(nonExistentRequest, nonExistentContext);
  assert(notFoundResponse.status === 404, "GET /api/orders/[id] returns 404 for non-existent order");

  // TEST SUITE 5: GET /api/orders/[id]/preview Route
  console.log("\n--- 5. Preview Stream API (GET /api/orders/[id]/preview) ---");
  const previewRequest = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/preview`);
  const previewContext = { params: Promise.resolve({ id: testOrderId }) };
  const previewResponse = await previewHandler(previewRequest, previewContext);
  assert(previewResponse.status === 200, "GET /api/orders/[id]/preview HTTP 200");
  const contentType = previewResponse.headers.get("Content-Type");
  assert(Boolean(contentType?.includes("image/")), "Preview response returns image content type", `Content-Type: ${contentType}`);

  // Summary
  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Verification execution crashed:", err);
  process.exit(1);
});
