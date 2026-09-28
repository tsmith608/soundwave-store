/**
 * Adversarial & Concurrency Stress Test Suite for Milestone 1
 * Targets: SQLite DB Subsystem, Prisma Helpers, Webhook Idempotency, Extreme Inputs, SQLi
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
  ORDER_STATUSES,
  type OrderStatus,
} from "../src/lib/db";
import {
  validateAudioUpload,
  detectAudioFormat,
  estimateAudioDuration,
} from "../src/lib/audio";
import { GET as orderHandler } from "../src/app/api/orders/[id]/route";
import { NextRequest } from "next/server";

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function test(category: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, category, passed: true, durationMs });
    console.log(`  [PASS] [${category}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({
      name,
      category,
      passed: false,
      durationMs,
      error: err?.message || String(err),
      details: err?.stack,
    });
    console.error(`  [FAIL] [${category}] ${name} (${durationMs}ms): ${err?.message || err}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runAllStressTests() {
  console.log("================================================================================");
  console.log("   SOUNDWAVE ART — MILESTONE 1 ADVERSARIAL & CONCURRENCY STRESS SUITE");
  console.log("================================================================================\n");

  const runId = `stress_${Date.now()}`;

  // -------------------------------------------------------------------------
  // GROUP 1: CONCURRENT ORDER CREATION & WRITE CONTENTION
  // -------------------------------------------------------------------------
  console.log(">>> GROUP 1: Concurrent Order Creation & High Write Contention");

  await test("Concurrency", "50 concurrent order creations with unique parameters", async () => {
    const count = 50;
    const promises = Array.from({ length: count }, (_, i) => {
      const orderId = `ord_conc_50_${runId}_${i}`;
      const sessId = `cs_conc_50_${runId}_${i}`;
      return createOrder({
        id: orderId,
        customerEmail: `stress_user_${i}@example.com`,
        shippingName: `Stress User ${i}`,
        shippingAddress: `${i} Contention Blvd, Unit ${i}, Portland, OR 97201`,
        frameSize: i % 2 === 0 ? "16x20" : "24x36",
        palette: i % 2 === 0 ? "midnight_gold" : "ocean_navy",
        caption: `Concurrent Order #${i} — Timestamp: ${Date.now()}`,
        audioPath: `storage/uploads/audio_${runId}_${i}.wav`,
        totalAmount: 9900 + i * 100,
        stripeSessionId: sessId,
      });
    });

    const created = await Promise.all(promises);
    assert(created.length === count, `Expected ${count} orders created, got ${created.length}`);

    // Verify all 50 can be retrieved from DB
    const verificationQueries = created.map((o) => getOrderById(o.id));
    const verified = await Promise.all(verificationQueries);
    for (let i = 0; i < count; i++) {
      assert(verified[i] !== null, `Order #${i} could not be retrieved from DB`);
      assert(verified[i]?.customerEmail === `stress_user_${i}@example.com`, `Order #${i} email mismatch`);
    }
  });

  await test("Concurrency", "100 rapid concurrent order creations under sustained load", async () => {
    const count = 100;
    const promises = Array.from({ length: count }, (_, i) => {
      const orderId = `ord_conc_100_${runId}_${i}`;
      const sessId = `cs_conc_100_${runId}_${i}`;
      return createOrder({
        id: orderId,
        customerEmail: `load_user_${i}@example.com`,
        frameSize: "8x10",
        palette: "everest_silver",
        caption: `Load test ${i}`,
        audioPath: `storage/uploads/load_${i}.mp3`,
        totalAmount: 4900,
        stripeSessionId: sessId,
      });
    });

    const created = await Promise.all(promises);
    assert(created.length === count, `Expected ${count} orders created`);
  });

  // -------------------------------------------------------------------------
  // GROUP 2: CONCURRENT STATE TRANSITIONS & FULFILLMENT LOGS
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 2: Concurrent State Transitions & Fulfillment Logs");

  await test("State Transitions", "20 concurrent order status transitions across multiple orders", async () => {
    // First create 20 orders
    const orders = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createOrder({
          id: `ord_trans_${runId}_${i}`,
          customerEmail: `trans_${i}@test.com`,
          frameSize: "11x14",
          palette: "nordic_slate",
          audioPath: `storage/uploads/trans_${i}.wav`,
          totalAmount: 6900,
        })
      )
    );

    // Simultaneously transition all 20 to pending_fulfillment
    const updates = orders.map((o, i) =>
      updateOrderStatus(o.id, "pending_fulfillment", {
        partnerOrderId: `partner_${i}`,
        shippingName: `Recipient ${i}`,
      })
    );
    const updated = await Promise.all(updates);
    for (const u of updated) {
      assert(u.status === "pending_fulfillment", `Expected status pending_fulfillment, got ${u.status}`);
      assert(u.partnerOrderId !== null, `Expected partnerOrderId to be set`);
    }
  });

  await test("State Transitions", "Race Condition: 10 concurrent status updates targeting the SAME order", async () => {
    const targetOrderId = `ord_race_${runId}`;
    await createOrder({
      id: targetOrderId,
      customerEmail: "race_target@test.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      audioPath: "storage/uploads/race.wav",
      totalAmount: 9900,
    });

    // 10 concurrent status updates racing on the same row
    const statuses: OrderStatus[] = [
      "pending_fulfillment",
      "fulfillment_submitted",
      "pending_fulfillment",
      "fulfillment_submitted",
      "shipped",
      "fulfillment_submitted",
      "shipped",
      "delivered",
      "shipped",
      "delivered",
    ];

    const racingUpdates = statuses.map((st, i) =>
      updateOrderStatus(targetOrderId, st, {
        partnerOrderId: `race_partner_${i}`,
      })
    );

    const raceResults = await Promise.all(racingUpdates);
    assert(raceResults.length === 10, "All 10 racing updates completed without crashing");

    // The final state in DB must be valid
    const finalOrder = await getOrderById(targetOrderId);
    assert(finalOrder !== null, "Target order exists");
    assert(
      ["pending_fulfillment", "fulfillment_submitted", "shipped", "delivered"].includes(finalOrder!.status),
      `Final status ${finalOrder?.status} must be one of the attempted statuses`
    );
  });

  await test("Fulfillment Logs", "50 concurrent fulfillment log writes to the SAME order", async () => {
    const logOrderId = `ord_log_stress_${runId}`;
    await createOrder({
      id: logOrderId,
      customerEmail: "log_user@test.com",
      frameSize: "8x10",
      palette: "ocean_navy",
      audioPath: "storage/uploads/log.wav",
      totalAmount: 4900,
    });

    const logSteps = [
      "waveform_extraction",
      "pdf_generation",
      "qr_generation",
      "preview_render",
      "partner_submission",
    ];

    const logPromises = Array.from({ length: 50 }, (_, i) => {
      const step = logSteps[i % logSteps.length];
      return addFulfillmentLog(logOrderId, step, "success", `Detail message for worker iteration ${i}`);
    });

    const createdLogs = await Promise.all(logPromises);
    assert(createdLogs.length === 50, `Expected 50 logs created, got ${createdLogs.length}`);

    // Query logs back
    const fetchedLogs = await getFulfillmentLogs(logOrderId);
    assert(fetchedLogs.length === 50, `Expected 50 logs fetched from DB, got ${fetchedLogs.length}`);
    for (const l of fetchedLogs) {
      assert(l.orderId === logOrderId, `Log has incorrect orderId: ${l.orderId}`);
      assert(l.status === "success", "Log status should be success");
    }
  });

  // -------------------------------------------------------------------------
  // GROUP 3: WEBHOOK EVENT IDEMPOTENCY (THE 50 CONCURRENT DUPLICATE TEST)
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 3: Webhook Event Idempotency (50 Duplicate Deliveries)");

  await test("Webhook Idempotency", "Simulate 50 duplicate webhook deliveries concurrently for identical eventId", async () => {
    const duplicateEventId = `evt_dup_stress_50_${runId}`;
    const payload = {
      id: duplicateEventId,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_webhook_${runId}`,
          amount_total: 9900,
          customer_details: { email: "customer@example.com" },
        },
      },
    };

    // Before starting, event must not be marked processed
    const initialProcessed = await isWebhookProcessed(duplicateEventId);
    assert(!initialProcessed, "Event should not be processed prior to webhook arrival");

    // Launch 50 SIMULTANEOUS calls to recordWebhookEvent with same eventId
    const deliveries = Array.from({ length: 50 }, () =>
      recordWebhookEvent(duplicateEventId, "checkout.session.completed", "processed", payload)
    );

    const outcomes = await Promise.all(deliveries);
    assert(outcomes.length === 50, "All 50 webhook delivery calls resolved successfully");

    // Check database row count: MUST BE EXACTLY 1 row for duplicateEventId
    const matchingEvents = await prisma.webhookEvent.findMany({
      where: { eventId: duplicateEventId },
    });
    assert(
      matchingEvents.length === 1,
      `Expected EXACTLY 1 WebhookEvent record for ${duplicateEventId}, found ${matchingEvents.length}`
    );

    // Verify status is processed and processedAt is non-null
    assert(matchingEvents[0].status === "processed", `Status should be 'processed', got ${matchingEvents[0].status}`);
    assert(matchingEvents[0].processedAt !== null, "processedAt should be populated");

    // Check isWebhookProcessed returns true
    const finalProcessed = await isWebhookProcessed(duplicateEventId);
    assert(finalProcessed === true, "isWebhookProcessed should return true");
  });

  await test("Webhook Idempotency", "Alternating statuses under concurrent flood ('received' vs 'processed')", async () => {
    const alternatingEventId = `evt_alt_stress_${runId}`;
    const payload = { test: true, iteration: "alternating" };

    // 25 calls with 'received', 25 calls with 'processed' interleaved concurrently
    const calls = Array.from({ length: 50 }, (_, i) => {
      const status = i % 2 === 0 ? "received" : "processed";
      return recordWebhookEvent(alternatingEventId, "checkout.session.completed", status, payload);
    });

    const results = await Promise.all(calls);
    assert(results.length === 50, "All 50 alternating webhook calls resolved");

    const events = await prisma.webhookEvent.findMany({
      where: { eventId: alternatingEventId },
    });
    assert(events.length === 1, `Expected exactly 1 record, got ${events.length}`);
  });

  await test("Webhook Payload", "Massive 100KB nested JSON webhook payload handling", async () => {
    const largeEventId = `evt_large_payload_${runId}`;
    // Construct a ~100KB payload
    const deepObject: Record<string, any> = {
      orderId: `ord_large_${runId}`,
      items: [],
    };
    for (let i = 0; i < 500; i++) {
      deepObject.items.push({
        index: i,
        name: `Audio Wave Print Item #${i}`,
        sku: `SKU-PRINT-${i}-X`,
        notes: "A".repeat(150),
        metadata: {
          key: `meta_${i}`,
          subValue: `val_${i}`,
        },
      });
    }

    const recorded = await recordWebhookEvent(largeEventId, "payment_intent.succeeded", "processed", deepObject);
    assert(recorded.eventId === largeEventId, "Large payload webhook recorded");

    // Fetch and verify JSON deserialization
    const fetched = await prisma.webhookEvent.findUnique({
      where: { eventId: largeEventId },
    });
    assert(fetched !== null, "Large payload event retrievable");
    const parsed = JSON.parse(fetched!.payload);
    assert(parsed.items.length === 500, `Expected 500 items in parsed payload, got ${parsed.items?.length}`);
    assert(parsed.items[499].notes.length === 150, "Payload contents fully intact");
  });

  // -------------------------------------------------------------------------
  // GROUP 4: SQL INJECTION & ADVERSARIAL PARAMETER FUZZING
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 4: SQL Injection & Adversarial Parameter Fuzzing");

  const sqliVectors = [
    "' OR '1'='1",
    "'; DROP TABLE Order; --",
    "'; DROP TABLE WebhookEvent; --",
    "admin' --",
    "1 UNION SELECT id, customerEmail, 'hacked' FROM Order --",
    "' OR 1=1; SELECT * FROM Order WHERE ''='",
    "\\x27\\x20OR\\x201=1--",
    "'; VACUUM; --",
    "'; ATTACH DATABASE 'storage/evil.db' AS evil; --",
  ];

  for (const vector of sqliVectors) {
    await test("SQL Injection", `getOrderById with vector: ${vector.substring(0, 30)}...`, async () => {
      // Must return null, NOT execute SQL, NOT crash DB
      const result = await getOrderById(vector);
      assert(result === null, `Expected null for non-existent injected ID, got ${JSON.stringify(result)}`);

      // Verify Order table still exists and has records
      const count = await prisma.order.count();
      assert(count > 0, "Order table is intact and has records");
    });
  }

  await test("SQL Injection", "createOrder with SQL injection in every text field", async () => {
    const maliciousOrder = await createOrder({
      id: `ord_sqli_${runId}`,
      customerEmail: "victim'; DROP TABLE Order; --@exploit.com",
      shippingName: "Robert'); DROP TABLE FulfillmentLog;--",
      shippingAddress: "123 Injection Way; DELETE FROM WebhookEvent WHERE 'a'='a",
      frameSize: "16x20' OR '1'='1",
      palette: "midnight_gold'; SELECT * FROM sqlite_master;--",
      caption: "Our Wedding <script>alert(1)</script> '; DROP TABLE Order;-- 🎵",
      audioPath: "storage/uploads/audio'; rm -rf /; .wav",
      totalAmount: 9900,
      stripeSessionId: `sess_sqli_${runId}`,
    });

    assert(maliciousOrder.id === `ord_sqli_${runId}`, "Order with SQLi created safely");

    // Fetch and verify fields were stored literally without executing
    const retrieved = await getOrderById(`ord_sqli_${runId}`);
    assert(retrieved !== null, "Malicious order retrievable");
    assert(retrieved?.shippingName === "Robert'); DROP TABLE FulfillmentLog;--", "shippingName preserved literally");
    assert(Boolean(retrieved?.caption?.includes("'; DROP TABLE Order;--")), "caption preserved literally");

    // Check table integrity
    const logCount = await prisma.fulfillmentLog.count();
    const eventCount = await prisma.webhookEvent.count();
    assert(logCount >= 0 && eventCount >= 0, "All tables exist and remain queryable");
  });

  await test("SQL Injection", "HTTP Route GET /api/orders/[id] with SQL injection path param", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders/%27%20OR%20%271%27=%271");
    const context = { params: Promise.resolve({ id: "' OR '1'='1" }) };
    const res = await orderHandler(req, context);
    assert(res.status === 404, `Expected HTTP 404 for injected ID, got ${res.status}`);
    const json = await res.json();
    assert(json.error === "Order not found", `Expected 'Order not found', got ${json.error}`);
  });

  // -------------------------------------------------------------------------
  // GROUP 5: EXTREME IDS, UNICODE, EMOJI & SCRIPT FUZZING
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 5: Extreme IDs, Unicode, Emoji & Script Fuzzing");

  await test("Extreme IDs", "10,000-character long string ID", async () => {
    const longId = `ord_long_${runId}_${"A".repeat(9950)}`;
    const created = await createOrder({
      id: longId,
      customerEmail: "longid@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/long.wav",
      totalAmount: 4900,
    });
    assert(created.id === longId, "Order with 10k character ID created");

    const fetched = await getOrderById(longId);
    assert(fetched !== null && fetched.id === longId, "Order with 10k character ID retrieved");
  });

  await test("Extreme IDs", "ID with URL/special characters, slashes, and spaces", async () => {
    const specialId = `ord_special!@#$^&*()_+=-[]{}|;:,.<>?~ \t_${runId}`;
    const created = await createOrder({
      id: specialId,
      customerEmail: "specialid@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/special.wav",
      totalAmount: 4900,
    });
    assert(created.id === specialId, "Order with special chars ID created");

    const fetched = await getOrderById(specialId);
    assert(fetched !== null && fetched.id === specialId, "Order with special chars ID retrieved");
  });

  await test("Extreme IDs", "ID with multi-byte emoji", async () => {
    const emojiId = `ord_🔥_🎵_💍_✨_${runId}`;
    const created = await createOrder({
      id: emojiId,
      customerEmail: "emoji_id@test.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      audioPath: "storage/uploads/emoji_id.wav",
      totalAmount: 9900,
    });
    assert(created.id === emojiId, "Order with emoji ID created");

    const fetched = await getOrderById(emojiId);
    assert(fetched !== null && fetched.id === emojiId, "Order with emoji ID retrieved");
  });

  await test("Unicode & Emoji", "Complex multi-lingual captions: CJK, Arabic RTL, Diacritics, Zalgo & Emoji", async () => {
    const testCases = [
      {
        lang: "Multi-Emoji",
        caption: "💍 Wedding Vows: Sarah & David ❤️ 🎶 👨‍👩‍👧‍👦 🎸 ✨ 🌈 🕊️",
      },
      {
        lang: "Chinese (Simplified & Traditional)",
        caption: "我们的第一首歌 — 2025年9月20日 祝你生日快乐，永远幸福！",
      },
      {
        lang: "Arabic (Right-to-Left)",
        caption: "أغنيتنا الأولى - ذكرى زواجنا السعيد في القاهرة ٢٠٢٥",
      },
      {
        lang: "Hebrew (Right-to-Left)",
        caption: "שיר החתונה שלנו - עמנואל ושרה 2025",
      },
      {
        lang: "Japanese (Kanji/Hiragana/Katakana)",
        caption: "二人の愛のメロディ 🌸 赤ちゃんの初めての心音 2025年",
      },
      {
        lang: "Cyrillic & Extended Accents",
        caption: "Наша первая песня — Café des Âmes Égarées & Häagen-Dazs, München",
      },
      {
        lang: "Zalgo / Combining characters",
        caption: "H̶e̶l̶l̶o̶ ̶W̶o̶r̶l̶d̶ ̶S̶o̶u̶n̶d̶W̶a̶v̶e̶",
      },
      {
        lang: "Mathematical & Gothic Unicode",
        caption: "𝔖𝔬𝔲𝔫𝔡𝔚𝔞𝔳𝔢 𝔸𝕣𝕥 𝟚𝟘𝟚𝟝 𝄞 𝄢 𝄡",
      },
      {
        lang: "Massive 5000-character caption",
        caption: "Custom Memory Caption: " + "🎵🎶".repeat(1250),
      },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const ordId = `ord_unicode_${runId}_${i}`;
      await createOrder({
        id: ordId,
        customerEmail: `unicode_${i}@test.com`,
        frameSize: "16x20",
        palette: "midnight_gold",
        caption: tc.caption,
        audioPath: `storage/uploads/u_${i}.wav`,
        totalAmount: 9900,
      });

      const fetched = await getOrderById(ordId);
      assert(fetched !== null, `Failed to retrieve order for ${tc.lang}`);
      assert(
        fetched?.caption === tc.caption,
        `Caption mismatch for ${tc.lang}: length ${fetched?.caption?.length} vs expected ${tc.caption.length}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // GROUP 6: CONSTRAINTS, UNIQUENESS & BOUNDARY HANDLING
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 6: Constraints, Uniqueness & Boundary Values");

  await test("Constraints", "Unique constraint enforcement on stripeSessionId", async () => {
    const uniqueSessionId = `cs_unique_${runId}`;
    await createOrder({
      id: `ord_u1_${runId}`,
      customerEmail: "user1@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/u1.wav",
      totalAmount: 4900,
      stripeSessionId: uniqueSessionId,
    });

    let duplicateRejected = false;
    try {
      await createOrder({
        id: `ord_u2_${runId}`,
        customerEmail: "user2@test.com",
        frameSize: "8x10",
        palette: "midnight_gold",
        audioPath: "storage/uploads/u2.wav",
        totalAmount: 4900,
        stripeSessionId: uniqueSessionId, // Duplicate!
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert(
        err.message.includes("Unique constraint") || err.code === "P2002",
        `Expected P2002 Unique constraint error, got: ${err.message}`
      );
    }
    assert(duplicateRejected, "Duplicate stripeSessionId must be rejected by Prisma/SQLite");
  });

  await test("Constraints", "Cascade delete: deleting an Order must delete its FulfillmentLogs", async () => {
    const cascadeOrderId = `ord_cascade_${runId}`;
    await createOrder({
      id: cascadeOrderId,
      customerEmail: "cascade@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/casc.wav",
      totalAmount: 4900,
    });

    // Add 5 fulfillment logs
    for (let i = 0; i < 5; i++) {
      await addFulfillmentLog(cascadeOrderId, `step_${i}`, "success", `Detail ${i}`);
    }

    const beforeLogs = await getFulfillmentLogs(cascadeOrderId);
    assert(beforeLogs.length === 5, `Expected 5 logs before delete, got ${beforeLogs.length}`);

    // Delete the order
    await prisma.order.delete({
      where: { id: cascadeOrderId },
    });

    // Verify order is gone
    const fetchedOrder = await getOrderById(cascadeOrderId);
    assert(fetchedOrder === null, "Order should be deleted");

    // Verify logs were cascaded
    const afterLogs = await getFulfillmentLogs(cascadeOrderId);
    assert(afterLogs.length === 0, `Expected 0 logs after cascade delete, got ${afterLogs.length}`);
  });

  await test("Boundary Values", "Integer boundary test on totalAmount (0, max 32-bit int, negative)", async () => {
    // Zero amount (free promo)
    const zeroOrder = await createOrder({
      id: `ord_zero_${runId}`,
      customerEmail: "zero@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/zero.wav",
      totalAmount: 0,
    });
    assert(zeroOrder.totalAmount === 0, "totalAmount = 0 accepted");

    // Max 32-bit signed int: 2,147,483,647 cents ($21,474,836.47)
    const maxIntOrder = await createOrder({
      id: `ord_maxint_${runId}`,
      customerEmail: "maxint@test.com",
      frameSize: "24x36",
      palette: "midnight_gold",
      audioPath: "storage/uploads/maxint.wav",
      totalAmount: 2147483647,
    });
    assert(maxIntOrder.totalAmount === 2147483647, "Max 32-bit signed int totalAmount accepted");

    // Negative amount check
    const negOrder = await createOrder({
      id: `ord_neg_${runId}`,
      customerEmail: "neg@test.com",
      frameSize: "8x10",
      palette: "midnight_gold",
      audioPath: "storage/uploads/neg.wav",
      totalAmount: -100,
    });
    assert(negOrder.totalAmount === -100, "Negative amount persisted (documenting behavior)");
  });

  // -------------------------------------------------------------------------
  // GROUP 7: AUDIO PARSER ADVERSARIAL FUZZING
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 7: Audio Parser Adversarial & Malformed Input Fuzzing");

  await test("Audio Parser", "Empty buffer validation rejection", async () => {
    const emptyBuf = Buffer.alloc(0);
    const res = validateAudioUpload(emptyBuf, "empty.wav", "audio/wav");
    assert(!res.valid, "Empty buffer must be rejected");
    assert(Boolean(res.error?.includes("Empty")), "Error mentions empty file");
  });

  await test("Audio Parser", "Buffer > 50MB size limit rejection", async () => {
    // 51MB buffer
    const bigBuf = Buffer.alloc(51 * 1024 * 1024);
    const res = validateAudioUpload(bigBuf, "huge.wav", "audio/wav");
    assert(!res.valid, "Buffer > 50MB must be rejected");
    assert(Boolean(res.error?.includes("exceeds maximum size")), "Error mentions size limit");
  });

  await test("Audio Parser", "Malformed WAV with zero-size chunks and byteRate = 0", async () => {
    // Buffer with RIFF and WAVE magic, but truncated fmt chunk
    const malformedWav = Buffer.alloc(36);
    malformedWav.write("RIFF", 0, "ascii");
    malformedWav.writeUInt32LE(36, 4);
    malformedWav.write("WAVE", 8, "ascii");
    malformedWav.write("fmt ", 12, "ascii");
    malformedWav.writeUInt32LE(0, 16); // Chunk size 0

    const res = validateAudioUpload(malformedWav, "broken.wav", "audio/wav");
    assert(!res.valid, "Malformed WAV with zero-size chunks must be rejected");
  });

  await test("Audio Parser", "Truncated MP3 with corrupt sync word and ID3 tag", async () => {
    const corruptMp3 = Buffer.alloc(50);
    corruptMp3.write("ID3", 0, "ascii");
    corruptMp3[6] = 0x7f;
    corruptMp3[7] = 0x7f;
    corruptMp3[8] = 0x7f;
    corruptMp3[9] = 0x7f; // Huge declared tag size exceeding buffer length

    const res = validateAudioUpload(corruptMp3, "corrupt.mp3", "audio/mpeg");
    assert(!res.valid, "Truncated MP3 with corrupt sync word must be rejected");
  });

  await test("Audio Parser", "Polyglot / disguised executable with audio extension", async () => {
    // MZ header (Windows PE executable) renamed to .wav
    const exeBuf = Buffer.alloc(1024);
    exeBuf.write("MZ", 0, "ascii");

    const res = validateAudioUpload(exeBuf, "trojan.wav", "application/octet-stream");
    assert(!res.valid, "Polyglot executable disguised as audio must be rejected");
  });

  // -------------------------------------------------------------------------
  // GROUP 8: SECURITY, PATH TRAVERSAL & SVG PREVIEW SANITIZATION
  // -------------------------------------------------------------------------
  console.log("\n>>> GROUP 8: Security, Path Traversal & SVG Preview Sanitization");

  await test("Security", "SVG Preview XML validity: caption with ampersand (&) must be XML-escaped", async () => {
    const ampOrderId = `ord_amp_${runId}`;
    await createOrder({
      id: ampOrderId,
      customerEmail: "amp@test.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      caption: "Sarah & David — October 14, 2024",
      audioPath: "storage/uploads/amp.wav",
      totalAmount: 9900,
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${ampOrderId}/preview`);
    const res = await (await import("../src/app/api/orders/[id]/preview/route")).GET(req, {
      params: Promise.resolve({ id: ampOrderId }),
    });
    const svgContent = await res.text();

    // In valid XML/SVG, raw '&' must be escaped as '&amp;'
    // A raw '&' followed by non-entity syntax is an invalid XML document
    const hasRawAmpersand = /<text[^>]*>[^<]*&(?!(amp|lt|gt|quot|apos);)[^<]*<\/text>/.test(svgContent);
    assert(!hasRawAmpersand, "SVG text node contains unescaped raw '&' (invalid XML/SVG; renders broken image)");
  });

  await test("Security", "SVG Preview XSS prevention: caption with SVG tags must be escaped", async () => {
    const xssOrderId = `ord_xss_${runId}`;
    await createOrder({
      id: xssOrderId,
      customerEmail: "xss@test.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      caption: "</text><script>alert(1)</script><text>",
      audioPath: "storage/uploads/xss.wav",
      totalAmount: 9900,
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${xssOrderId}/preview`);
    const res = await (await import("../src/app/api/orders/[id]/preview/route")).GET(req, {
      params: Promise.resolve({ id: xssOrderId }),
    });
    const svgContent = await res.text();
    assert(!svgContent.includes("<script>"), "SVG content contains unescaped <script> tag (Stored XSS vulnerability)");
  });

  await test("Security", "Path traversal defense: previewUrl pointing to package.json must NOT be disclosed", async () => {
    const travOrderId = `ord_trav_${runId}`;
    await createOrder({
      id: travOrderId,
      customerEmail: "trav@test.com",
      frameSize: "16x20",
      palette: "midnight_gold",
      audioPath: "storage/uploads/trav.wav",
      previewUrl: "package.json", // Path outside storage/previews
      totalAmount: 9900,
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${travOrderId}/preview`);
    const res = await (await import("../src/app/api/orders/[id]/preview/route")).GET(req, {
      params: Promise.resolve({ id: travOrderId }),
    });
    const content = await res.text();
    assert(!content.includes("soundwave-store"), "Preview endpoint disclosed package.json content via previewUrl traversal");
  });

  await test("Robustness", "Unpaired surrogate handling: createOrder should handle lone surrogate without Rust crash", async () => {
    const surrogateOrderId = `ord_surr_${runId}`;
    try {
      await createOrder({
        id: surrogateOrderId,
        customerEmail: "surr@test.com",
        frameSize: "16x20",
        palette: "midnight_gold",
        caption: "Incomplete emoji: \uD83C",
        audioPath: "storage/uploads/surr.wav",
        totalAmount: 9900,
      });
    } catch (err: any) {
      if (err.message.includes("unexpected end of hex escape")) {
        throw new Error("createOrder crashed with Prisma/Rust 'unexpected end of hex escape' on unpaired surrogate");
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log("\n================================================================================");
  console.log("   STRESS TEST SUITE EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(`Total tests run: ${total}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    console.error("FAILURES DETECTED:");
    for (const f of results.filter((r) => !r.passed)) {
      console.error(`- [${f.category}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log("ALL STRESS & CONCURRENCY TESTS COMPLETED SUCCESSFULLY.");
  }
}

runAllStressTests().catch((err) => {
  console.error("Fatal stress test runner failure:", err);
  process.exit(1);
});
