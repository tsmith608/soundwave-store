/**
 * Resend Webhooks & Svix Signature Verification Test Suite (Milestone 4)
 *
 * Tests:
 * 1. Svix HMAC-SHA256 Cryptographic Verification
 * 2. Rejection of Missing Svix Headers (HTTP 400)
 * 3. Rejection of Tampered Svix Signatures (HTTP 400)
 * 4. Rejection of Expired Timestamps > 300s (HTTP 400)
 * 5. Acceptance of Valid Svix Signatures for email.delivered
 * 6. Acceptance of Valid Svix Signatures for email.bounced
 * 7. Acceptance of Valid Svix Signatures for email.complained
 * 8. Order Status, Timestamp & Bounce Reason Mutations in PostgreSQL
 * 9. Webhook Idempotency (duplicate_ignored on replay)
 * 10. Audit Logging in EmailEvent Table
 * 11. Handling of email.opened and email.clicked events
 */

import { NextRequest } from "next/server";
import { POST as resendWebhookHandler } from "@/app/api/webhooks/resend/route";
import { verifySvixSignature, createSvixSignature } from "@/lib/svix";
import {
  prisma,
  createOrder,
  getOrderById,
  getEmailEvents,
} from "@/lib/db";

const TEST_SECRET = "whsec_test_secret_32chars_long_1234567890";

let passed = 0;
let failed = 0;

function assert(condition: any, testName: string, details?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

async function runResendWebhookTests() {
  console.log("==================================================");
  console.log("   SOUNDWAVE ART — RESEND WEBHOOKS VERIFICATION");
  console.log("==================================================\n");

  // --------------------------------------------------------------------------
  // SUITE 1: Svix Cryptographic Unit Tests
  // --------------------------------------------------------------------------
  console.log("--- 1. Svix Cryptographic Signature Verification ---");

  const sampleBody = JSON.stringify({ type: "email.sent", data: { id: "re_123" } });

  // 1.1 Valid signature
  const validSigData = createSvixSignature(sampleBody, TEST_SECRET);
  const validCheck = verifySvixSignature(sampleBody, validSigData.headers, TEST_SECRET);
  assert(validCheck.valid, "Valid Svix signature verified successfully");

  // 1.2 Missing headers
  const missingHeaderCheck = verifySvixSignature(sampleBody, {}, TEST_SECRET);
  assert(!missingHeaderCheck.valid, "Rejects missing Svix headers");
  assert(missingHeaderCheck.reason?.includes("Missing"), "Provides missing headers reason");

  // 1.3 Tampered signature
  const tamperedSig = validSigData.signature.slice(0, -6) + "XXXX==";
  const tamperedCheck = verifySvixSignature(
    sampleBody,
    { ...validSigData.headers, "svix-signature": tamperedSig },
    TEST_SECRET
  );
  assert(!tamperedCheck.valid, "Rejects tampered Svix signature");
  assert(tamperedCheck.reason?.includes("Invalid HMAC"), "Provides invalid HMAC reason");

  // 1.4 Expired timestamp (>300 seconds past)
  const expiredPastTs = Math.floor(Date.now() / 1000) - 310;
  const expiredPastSig = createSvixSignature(sampleBody, TEST_SECRET, { timestamp: expiredPastTs });
  const expiredPastCheck = verifySvixSignature(sampleBody, expiredPastSig.headers, TEST_SECRET);
  assert(!expiredPastCheck.valid, "Rejects expired past timestamp (>300s)");
  assert(expiredPastCheck.reason?.includes("expired"), "Provides expired timestamp reason");

  // 1.5 Future timestamp drift (>300 seconds ahead)
  const futureTs = Math.floor(Date.now() / 1000) + 315;
  const futureSig = createSvixSignature(sampleBody, TEST_SECRET, { timestamp: futureTs });
  const futureCheck = verifySvixSignature(sampleBody, futureSig.headers, TEST_SECRET);
  assert(!futureCheck.valid, "Rejects excessive future timestamp drift (>300s)");

  // 1.6 Multi-signature support (e.g. key rotation or multiple signatures)
  const multiSigHeader = `v1,fake_sig_abc123== ${validSigData.signature}`;
  const multiSigCheck = verifySvixSignature(
    sampleBody,
    { ...validSigData.headers, "svix-signature": multiSigHeader },
    TEST_SECRET
  );
  assert(multiSigCheck.valid, "Validates correctly when multiple signatures are present in header");

  // --------------------------------------------------------------------------
  // SUITE 2: HTTP Route Security & Header Validation (HTTP 400s)
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Route Security & Rejection Cases (POST /api/webhooks/resend) ---");

  // 2.1 Rejection of missing Svix headers
  const noHeadersReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    body: sampleBody,
  });
  const noHeadersRes = await resendWebhookHandler(noHeadersReq);
  assert(noHeadersRes.status === 400, "Rejects request missing all Svix headers with HTTP 400");
  const noHeadersJson = await noHeadersRes.json();
  assert(Boolean(noHeadersJson.error), "Returns error payload on missing headers");

  // 2.2 Rejection of missing svix-signature header
  const partialHeadersReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": "msg_test_01",
      "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
    },
    body: sampleBody,
  });
  const partialHeadersRes = await resendWebhookHandler(partialHeadersReq);
  assert(partialHeadersRes.status === 400, "Rejects request missing svix-signature with HTTP 400");

  // 2.3 Rejection of tampered signatures
  const tamperedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": validSigData.id,
      "svix-timestamp": validSigData.timestamp,
      "svix-signature": "v1,tampered_signature_bytes==",
    },
    body: sampleBody,
  });
  const tamperedRes = await resendWebhookHandler(tamperedReq);
  assert(tamperedRes.status === 400, "Rejects tampered signature with HTTP 400");

  // 2.4 Rejection of expired timestamps (>300s)
  const expiredReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: expiredPastSig.headers,
    body: sampleBody,
  });
  const expiredRes = await resendWebhookHandler(expiredReq);
  assert(expiredRes.status === 400, "Rejects expired timestamp (>300s) with HTTP 400");

  // 2.5 Rejection of malformed JSON payload with valid signature
  const malformedJson = "{ this is not valid json }";
  const malformedSig = createSvixSignature(malformedJson, TEST_SECRET);
  const malformedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: malformedSig.headers,
    body: malformedJson,
  });
  const malformedRes = await resendWebhookHandler(malformedReq);
  assert(malformedRes.status === 400, "Rejects invalid JSON payload with HTTP 400");

  // --------------------------------------------------------------------------
  // SUITE 3: email.delivered Processing & Order Status Mutation
  // --------------------------------------------------------------------------
  console.log("\n--- 3. email.delivered Event Processing & Order Mutation ---");

  const testOrderIdDelivered = `ord_del_${Date.now()}`;
  await createOrder({
    id: testOrderIdDelivered,
    customerEmail: "delivered_buyer@example.com",
    frameSize: "16x20",
    palette: "midnight_gold",
    caption: "Our First Dance — Delivered Test",
    audioPath: "storage/uploads/test_del.wav",
    totalAmount: 9900,
    emailStatus: "not_sent",
  });

  const emailDeliveredId = `re_del_${Date.now()}`;
  const deliveredEventPayload = {
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: {
      email_id: emailDeliveredId,
      from: "SoundWave Art <onboarding@resend.dev>",
      to: ["delivered_buyer@example.com"],
      subject: `Your SoundWave Art order #${testOrderIdDelivered} has been shipped!`,
      tags: {
        orderId: testOrderIdDelivered,
      },
    },
  };

  const deliveredBody = JSON.stringify(deliveredEventPayload);
  const deliveredSvix = createSvixSignature(deliveredBody, TEST_SECRET);

  const deliveredReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: deliveredSvix.headers,
    body: deliveredBody,
  });

  const deliveredRes = await resendWebhookHandler(deliveredReq);
  assert(deliveredRes.status === 200, "POST /api/webhooks/resend returns HTTP 200 for email.delivered");
  const deliveredJson = await deliveredRes.json();
  assert(deliveredJson.received === true, "Response contains received: true");
  assert(deliveredJson.status === "processed", "Response status is 'processed'");

  // Verify Order record in PostgreSQL
  const dbOrderDelivered = await getOrderById(testOrderIdDelivered);
  assert(dbOrderDelivered !== null, "Delivered order found in database");
  assert(dbOrderDelivered?.emailStatus === "delivered", `Order emailStatus is 'delivered' (got ${dbOrderDelivered?.emailStatus})`);
  assert(dbOrderDelivered?.emailDeliveredAt !== null, "Order emailDeliveredAt timestamp is set");
  assert(dbOrderDelivered?.lastEmailEventAt !== null, "Order lastEmailEventAt timestamp is set");
  assert(dbOrderDelivered?.resendEmailId === emailDeliveredId, "Order resendEmailId matches Resend email_id");

  // --------------------------------------------------------------------------
  // SUITE 4: Webhook Idempotency (duplicate_ignored)
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Webhook Event Idempotency ---");

  // Replay exact same request with same svix-id
  const replayReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: deliveredSvix.headers,
    body: deliveredBody,
  });

  const replayRes = await resendWebhookHandler(replayReq);
  assert(replayRes.status === 200, "Replayed webhook returns HTTP 200");
  const replayJson = await replayRes.json();
  assert(replayJson.received === true, "Replay response contains received: true");
  assert(replayJson.status === "duplicate_ignored", "Replay response status is 'duplicate_ignored'");

  // --------------------------------------------------------------------------
  // SUITE 5: email.bounced Processing (Subject Regex Matching & Error Reason)
  // --------------------------------------------------------------------------
  console.log("\n--- 5. email.bounced Event Processing & Subject Regex Match ---");

  const testOrderIdBounced = `ord_bnc_${Date.now()}`;
  await createOrder({
    id: testOrderIdBounced,
    customerEmail: "invalid_mailbox@example.com",
    frameSize: "11x14",
    palette: "sage_cream",
    caption: "Bounced Test Order",
    audioPath: "storage/uploads/test_bnc.wav",
    totalAmount: 6900,
    emailStatus: "not_sent",
  });

  const emailBouncedId = `re_bnc_${Date.now()}`;
  const bounceMessage = "550 5.1.1 The email account that you tried to reach does not exist.";
  const bouncedEventPayload = {
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: {
      email_id: emailBouncedId,
      from: "SoundWave Art <onboarding@resend.dev>",
      to: ["invalid_mailbox@example.com"],
      // Test regex matching of order ID from subject without explicit tags
      subject: `Important update regarding your SoundWave Art order #${testOrderIdBounced}`,
      bounce: {
        message: bounceMessage,
        type: "hard_bounce",
      },
    },
  };

  const bouncedBody = JSON.stringify(bouncedEventPayload);
  const bouncedSvix = createSvixSignature(bouncedBody, TEST_SECRET);

  const bouncedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: bouncedSvix.headers,
    body: bouncedBody,
  });

  const bouncedRes = await resendWebhookHandler(bouncedReq);
  assert(bouncedRes.status === 200, "POST /api/webhooks/resend returns HTTP 200 for email.bounced");
  const bouncedJson = await bouncedRes.json();
  assert(bouncedJson.status === "processed", "Bounce event processed successfully");

  // Verify Order record in PostgreSQL
  const dbOrderBounced = await getOrderById(testOrderIdBounced);
  assert(dbOrderBounced !== null, "Bounced order found in database");
  assert(dbOrderBounced?.emailStatus === "bounced", `Order emailStatus is 'bounced' (got ${dbOrderBounced?.emailStatus})`);
  assert(dbOrderBounced?.emailBouncedAt !== null, "Order emailBouncedAt timestamp is set");
  assert(dbOrderBounced?.emailBounceReason === bounceMessage, "Order emailBounceReason matches bounce.message");

  // --------------------------------------------------------------------------
  // SUITE 6: email.complained Processing (Recipient Email Fallback Match)
  // --------------------------------------------------------------------------
  console.log("\n--- 6. email.complained Event Processing & Recipient Email Match ---");

  const uniqueComplainedEmail = `spam_complaint_${Date.now()}@example.com`;
  const testOrderIdComplained = `ord_cmp_${Date.now()}`;
  await createOrder({
    id: testOrderIdComplained,
    customerEmail: uniqueComplainedEmail,
    frameSize: "8x10",
    palette: "white_silver",
    caption: "Complaint Test Order",
    audioPath: "storage/uploads/test_cmp.wav",
    totalAmount: 4900,
    emailStatus: "delivered",
  });

  const emailComplainedId = `re_cmp_${Date.now()}`;
  const complainedEventPayload = {
    type: "email.complained",
    created_at: new Date().toISOString(),
    data: {
      email_id: emailComplainedId,
      from: "SoundWave Art <onboarding@resend.dev>",
      // Test customer email fallback matching without tags or subject ID
      to: [uniqueComplainedEmail],
      subject: "Your Weekly Fine Art Newsletter",
    },
  };

  const complainedBody = JSON.stringify(complainedEventPayload);
  const complainedSvix = createSvixSignature(complainedBody, TEST_SECRET);

  const complainedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: complainedSvix.headers,
    body: complainedBody,
  });

  const complainedRes = await resendWebhookHandler(complainedReq);
  assert(complainedRes.status === 200, "POST /api/webhooks/resend returns HTTP 200 for email.complained");
  const complainedJson = await complainedRes.json();
  assert(complainedJson.status === "processed", "Complaint event processed successfully");

  // Verify Order record in PostgreSQL
  const dbOrderComplained = await getOrderById(testOrderIdComplained);
  assert(dbOrderComplained !== null, "Complained order found in database");
  assert(dbOrderComplained?.emailStatus === "complained", `Order emailStatus is 'complained' (got ${dbOrderComplained?.emailStatus})`);

  // --------------------------------------------------------------------------
  // SUITE 7: EmailEvent Audit Logging Table
  // --------------------------------------------------------------------------
  console.log("\n--- 7. EmailEvent Audit Logging in PostgreSQL ---");

  // Query audit logs for delivered order
  const deliveredEvents = await getEmailEvents(testOrderIdDelivered);
  assert(deliveredEvents.length >= 1, `Audit records found for delivered order (got ${deliveredEvents.length})`);
  assert(deliveredEvents[0].eventType === "email.delivered", "EmailEvent eventType is 'email.delivered'");
  assert(deliveredEvents[0].recipient === "delivered_buyer@example.com", "EmailEvent recipient matches");
  assert(deliveredEvents[0].resendEmailId === emailDeliveredId, "EmailEvent resendEmailId matches");

  // Query audit logs for bounced order
  const bouncedEvents = await getEmailEvents(testOrderIdBounced);
  assert(bouncedEvents.length >= 1, `Audit records found for bounced order (got ${bouncedEvents.length})`);
  assert(bouncedEvents[0].eventType === "email.bounced", "EmailEvent eventType is 'email.bounced'");
  assert(bouncedEvents[0].bounceReason === bounceMessage, "EmailEvent bounceReason recorded");

  // Query audit logs for complained order
  const complainedEvents = await getEmailEvents(testOrderIdComplained);
  assert(complainedEvents.length >= 1, `Audit records found for complained order (got ${complainedEvents.length})`);
  assert(complainedEvents[0].eventType === "email.complained", "EmailEvent eventType is 'email.complained'");

  // --------------------------------------------------------------------------
  // SUITE 8: email.opened and email.clicked Tracking
  // --------------------------------------------------------------------------
  console.log("\n--- 8. email.opened and email.clicked Tracking ---");

  const openClickOrderId = `ord_clk_${Date.now()}`;
  await createOrder({
    id: openClickOrderId,
    customerEmail: "open_click_buyer@example.com",
    frameSize: "24x36",
    palette: "art_deco",
    caption: "Open Click Test",
    audioPath: "storage/uploads/test_clk.wav",
    totalAmount: 14900,
    emailStatus: "delivered",
  });

  // Opened event
  const openedPayload = {
    type: "email.opened",
    data: {
      email_id: `re_opn_${Date.now()}`,
      to: ["open_click_buyer@example.com"],
      tags: { orderId: openClickOrderId },
    },
  };
  const openedBody = JSON.stringify(openedPayload);
  const openedSvix = createSvixSignature(openedBody, TEST_SECRET);
  const openedRes = await resendWebhookHandler(
    new NextRequest("http://localhost:3000/api/webhooks/resend", {
      method: "POST",
      headers: openedSvix.headers,
      body: openedBody,
    })
  );
  assert(openedRes.status === 200, "POST /api/webhooks/resend handles email.opened with HTTP 200");

  // Clicked event
  const clickedPayload = {
    type: "email.clicked",
    data: {
      email_id: `re_clk_${Date.now()}`,
      to: ["open_click_buyer@example.com"],
      tags: { orderId: openClickOrderId },
      click: {
        link: "https://soundwaveart.com/order/" + openClickOrderId,
      },
    },
  };
  const clickedBody = JSON.stringify(clickedPayload);
  const clickedSvix = createSvixSignature(clickedBody, TEST_SECRET);
  const clickedRes = await resendWebhookHandler(
    new NextRequest("http://localhost:3000/api/webhooks/resend", {
      method: "POST",
      headers: clickedSvix.headers,
      body: clickedBody,
    })
  );
  assert(clickedRes.status === 200, "POST /api/webhooks/resend handles email.clicked with HTTP 200");

  // Verify that delivered status remains 'delivered' (not overwritten by opened/clicked)
  const dbOrderOpenClick = await getOrderById(openClickOrderId);
  assert(dbOrderOpenClick?.emailStatus === "delivered", "Order emailStatus remains 'delivered' after opened and clicked");
  assert(dbOrderOpenClick?.lastEmailEventAt !== null, "lastEmailEventAt updated on opened/clicked");

  // Verify both events logged
  const openClickEvents = await getEmailEvents(openClickOrderId);
  assert(openClickEvents.length >= 2, `Audit records include opened and clicked events (got ${openClickEvents.length})`);

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`RESEND VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runResendWebhookTests().catch((err) => {
  console.error("Resend Verification Suite failed with exception:", err);
  process.exit(1);
});
