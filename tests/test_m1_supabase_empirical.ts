/**
 * Comprehensive Empirical Stress Test Suite for Milestone 1 (Supabase PostgreSQL)
 *
 * Tests:
 * 1. Live Supabase PostgreSQL Connection & Schema Metadata Introspection
 * 2. Full CRUD on all 5 models: Order, WebhookEvent, FulfillmentLog, EtsyToken, EmailEvent
 * 3. Foreign key cascades & constraint enforcement (FulfillmentLog, EmailEvent, Unique indexes)
 * 4. High-concurrency stress testing, idempotency storms, and atomic transactions
 * 5. SQLite PRAGMA bypass & Postgres dialect safety verification
 * 6. Unicode/Emoji data integrity, 100KB payload persistence, and clean teardown
 */

import { PrismaClient } from "@prisma/client";
import {
  prisma,
  ensurePragmas,
  createOrder,
  getOrderById,
  getOrderByPartnerOrderId,
  getOrderByStripeSessionId,
  updateOrderStatus,
  addFulfillmentLog,
  getFulfillmentLogs,
  recordWebhookEvent,
  isWebhookProcessed,
  saveEtsyToken,
  getEtsyToken,
  updateOrderEmailStatus,
  recordEmailEvent,
  getEmailEvents,
} from "../src/lib/db";

interface TestReport {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  expected: string;
  actual: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  details?: string;
}

const reports: TestReport[] = [];

async function runTest(
  id: string,
  category: string,
  name: string,
  expected: string,
  fn: () => Promise<void>,
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" = "MEDIUM"
) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    reports.push({
      id,
      category,
      name,
      passed: true,
      durationMs,
      expected,
      actual: "Passed successfully",
      severity,
    });
    console.log(`  [PASS] [${category}] ${id}: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const actual = err?.message || String(err);
    reports.push({
      id,
      category,
      name,
      passed: false,
      durationMs,
      expected,
      actual,
      severity,
      details: err?.stack,
    });
    console.error(`  [FAIL - ${severity}] [${category}] ${id}: ${name} (${durationMs}ms)`);
    console.error(`         Expected: ${expected}`);
    console.error(`         Actual:   ${actual.split("\n")[0]}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("   SOUNDWAVE ART — MILESTONE 1 EMPIRICAL SUPABASE POSTGRESQL CHALLENGE SUITE");
  console.log("================================================================================\n");

  const runPrefix = `m1_emp_${Date.now()}`;
  const cleanupOrderIds: string[] = [];
  const cleanupWebhookIds: string[] = [];
  const cleanupEtsyIds: string[] = [];
  const cleanupEmailIds: string[] = [];

  // Dedicated connection-limited client configured to operate safely within Supabase pool limit
  const rawDbUrl = process.env.DATABASE_URL || "";
  const pooledDbUrl = rawDbUrl.includes("connection_limit")
    ? rawDbUrl
    : `${rawDbUrl}${rawDbUrl.includes("?") ? "&" : "?"}connection_limit=5`;
  const pooledPrisma = new PrismaClient({
    datasources: { db: { url: pooledDbUrl } },
  });

  try {
    // =========================================================================
    // 1. LIVE SUPABASE POSTGRESQL CONNECTION & SCHEMA INTROSPECTION
    // =========================================================================
    console.log(">>> SUITE 1: Live Supabase PostgreSQL Connection & Schema Verification");

    await runTest(
      "T1.1",
      "Connection",
      "Connects to live PostgreSQL and verifies version and current schema",
      "Live connection returns PostgreSQL version and schema 'public'",
      async () => {
        const result: any[] = await prisma.$queryRawUnsafe(
          "SELECT current_database() AS db, version() AS version, current_schema() AS schema;"
        );
        assert(result.length > 0, "Query returned zero rows");
        assert(result[0].db === "postgres", `Expected db 'postgres', got '${result[0].db}'`);
        assert(
          typeof result[0].version === "string" && result[0].version.toLowerCase().includes("postgresql"),
          `Expected PostgreSQL in version string, got '${result[0].version}'`
        );
        assert(result[0].schema === "public", `Expected current_schema 'public', got '${result[0].schema}'`);
      },
      "CRITICAL"
    );

    await runTest(
      "T1.2",
      "Schema Introspection",
      "Verifies table catalog contains exactly the 5 SoundWave models and 0 legacy tables",
      "5 tables: Order, WebhookEvent, FulfillmentLog, EtsyToken, EmailEvent",
      async () => {
        const rows: any[] = await prisma.$queryRawUnsafe(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
        );
        const tables = rows.map((r) => r.table_name);
        const expected = ["EmailEvent", "EtsyToken", "FulfillmentLog", "Order", "WebhookEvent"];

        for (const exp of expected) {
          assert(tables.includes(exp), `Expected table '${exp}' not found in public schema`);
        }

        const legacyTables = [
          "instagram_posts",
          "link_clicks",
          "posts",
          "profiles",
          "subreddits",
          "tiktok_posts",
          "subscriptions",
        ];
        for (const leg of legacyTables) {
          assert(!tables.includes(leg), `Legacy table '${leg}' found in public schema`);
        }
      },
      "CRITICAL"
    );

    // =========================================================================
    // 2. FULL CRUD ON ALL 5 MODELS
    // =========================================================================
    console.log("\n>>> SUITE 2: Full CRUD on Order, WebhookEvent, FulfillmentLog, EtsyToken, EmailEvent");

    // 2.1 Order CRUD
    await runTest(
      "T2.1",
      "Order CRUD",
      "Performs Create, Read, Update, Delete on Order with Etsy & Resend fields",
      "Order created with full fields, queried, updated, and deleted",
      async () => {
        const orderId = `${runPrefix}_ord_crud`;
        cleanupOrderIds.push(orderId);

        // CREATE
        const created = await createOrder({
          id: orderId,
          customerEmail: "crud_tester@example.com",
          shippingName: "Jane Doe",
          shippingAddress: "456 Empirical Way, Seattle, WA 98101",
          frameSize: "16x20",
          palette: "midnight_gold",
          caption: "Empirical CRUD Order Test",
          audioPath: "storage/uploads/crud_test.wav",
          photoPath: "storage/uploads/photo.jpg",
          decorativeTheme: "botanical",
          totalAmount: 9900,
          partnerOrderId: `partner_${runPrefix}`,
          stripeSessionId: `cs_${runPrefix}_crud`,
          source: "etsy",
          externalOrderId: `etsy_${runPrefix}_123`,
          personalizationData: JSON.stringify({ song: "Song", artist: "Artist" }),
          etsyListingId: "list_999",
          etsyReceiptId: "rec_888",
          audioSourceUrl: "https://example.com/audio.mp3",
          resendEmailId: `re_${runPrefix}_crud`,
          emailStatus: "sent",
        });

        assert(created.id === orderId, "Order creation ID mismatch");
        assert(created.source === "etsy", "Etsy source mismatch");
        assert(created.externalOrderId === `etsy_${runPrefix}_123`, "External order ID mismatch");
        assert(created.resendEmailId === `re_${runPrefix}_crud`, "Resend email ID mismatch");

        // READ by ID
        const byId = await getOrderById(orderId);
        assert(byId !== null && byId.customerEmail === "crud_tester@example.com", "Order read by ID failed");

        // READ by PartnerOrderId
        const byPartner = await getOrderByPartnerOrderId(`partner_${runPrefix}`);
        assert(byPartner !== null && byPartner.id === orderId, "Order read by partnerOrderId failed");

        // READ by ExternalOrderId via getOrderByPartnerOrderId
        const byExternal = await getOrderByPartnerOrderId(`etsy_${runPrefix}_123`);
        assert(byExternal !== null && byExternal.id === orderId, "Order read by externalOrderId failed");

        // READ by StripeSessionId
        const byStripe = await getOrderByStripeSessionId(`cs_${runPrefix}_crud`);
        assert(byStripe !== null && byStripe.id === orderId, "Order read by stripeSessionId failed");

        // UPDATE
        const updated = await updateOrderStatus(orderId, "pending_fulfillment", {
          shippingName: "Jane Updated Doe",
          emailStatus: "delivered",
          previewUrl: "storage/previews/crud_preview.svg",
        });
        assert(updated.status === "pending_fulfillment", "Status update failed");
        assert(updated.shippingName === "Jane Updated Doe", "Shipping name update failed");
        assert(updated.emailStatus === "delivered", "Email status update failed");

        // DELETE
        await prisma.order.delete({ where: { id: orderId } });
        const postDelete = await getOrderById(orderId);
        assert(postDelete === null, "Order should be null after delete");
      },
      "HIGH"
    );

    // 2.2 WebhookEvent CRUD
    await runTest(
      "T2.2",
      "WebhookEvent CRUD",
      "Performs Create, Read, Update, Delete on WebhookEvent",
      "WebhookEvent created, queried, upserted, and deleted",
      async () => {
        const eventId = `evt_${runPrefix}_crud`;
        cleanupWebhookIds.push(eventId);

        // CREATE (upsert as received)
        const payload = { event: "test", amount: 9900, client: "tester" };
        const created = await recordWebhookEvent(eventId, "checkout.session.completed", "received", payload);
        assert(created.eventId === eventId, "WebhookEvent ID mismatch");
        assert(created.status === "received", "WebhookEvent initial status mismatch");

        // READ
        const processedBefore = await isWebhookProcessed(eventId);
        assert(!processedBefore, "Event should not be processed yet");

        const byEventId = await prisma.webhookEvent.findUnique({ where: { eventId } });
        assert(byEventId !== null && byEventId.eventType === "checkout.session.completed", "Read by eventId failed");

        // UPDATE (upsert as processed)
        const updated = await recordWebhookEvent(eventId, "checkout.session.completed", "processed", payload);
        assert(updated.status === "processed", "WebhookEvent updated status mismatch");
        assert(updated.processedAt !== null, "WebhookEvent processedAt should be set");

        const processedAfter = await isWebhookProcessed(eventId);
        assert(processedAfter === true, "isWebhookProcessed should now return true");

        // DELETE
        await prisma.webhookEvent.delete({ where: { eventId } });
        const postDelete = await prisma.webhookEvent.findUnique({ where: { eventId } });
        assert(postDelete === null, "WebhookEvent should be null after delete");
      },
      "HIGH"
    );

    // 2.3 FulfillmentLog CRUD
    await runTest(
      "T2.3",
      "FulfillmentLog CRUD",
      "Performs Create, Read, Update, Delete on FulfillmentLog",
      "FulfillmentLog linked to Order created, read, updated, and deleted",
      async () => {
        const parentOrderId = `${runPrefix}_ord_flog_parent`;
        cleanupOrderIds.push(parentOrderId);

        await createOrder({
          id: parentOrderId,
          customerEmail: "flog_tester@example.com",
          frameSize: "8x10",
          palette: "midnight_gold",
          audioPath: "storage/uploads/flog.wav",
          totalAmount: 4900,
        });

        // CREATE
        const log = await addFulfillmentLog(parentOrderId, "waveform_generation", "in_progress", "Started waveform");
        assert(log.orderId === parentOrderId, "FulfillmentLog orderId mismatch");
        assert(log.step === "waveform_generation", "FulfillmentLog step mismatch");

        // READ
        const logs = await getFulfillmentLogs(parentOrderId);
        assert(logs.length === 1 && logs[0].id === log.id, "getFulfillmentLogs read failed");

        // UPDATE
        const updatedLog = await prisma.fulfillmentLog.update({
          where: { id: log.id },
          data: { status: "success", details: "Waveform generated cleanly" },
        });
        assert(updatedLog.status === "success", "FulfillmentLog status update failed");

        // DELETE
        await prisma.fulfillmentLog.delete({ where: { id: log.id } });
        const postDeleteLogs = await getFulfillmentLogs(parentOrderId);
        assert(postDeleteLogs.length === 0, "FulfillmentLog should be deleted");

        await prisma.order.delete({ where: { id: parentOrderId } });
      },
      "HIGH"
    );

    // 2.4 EtsyToken CRUD
    await runTest(
      "T2.4",
      "EtsyToken CRUD",
      "Performs Create, Read, Update, Delete on EtsyToken",
      "EtsyToken created, read, rotated, and deleted",
      async () => {
        const shopId = `shop_${runPrefix}`;
        const expiresAt = new Date(Date.now() + 3600 * 1000);

        // CREATE
        const created = await saveEtsyToken({
          shopId,
          accessToken: "initial_access_token_12345",
          refreshToken: "initial_refresh_token_67890",
          expiresAt,
          tokenType: "Bearer",
          scope: "listings_r transactions_r",
        });
        cleanupEtsyIds.push(created.id);
        assert(created.shopId === shopId, "EtsyToken shopId mismatch");
        assert(created.accessToken === "initial_access_token_12345", "Access token mismatch");

        // READ
        const fetched = await getEtsyToken(shopId);
        assert(fetched !== null && fetched.id === created.id, "getEtsyToken by shopId failed");

        const latest = await getEtsyToken();
        assert(latest !== null, "getEtsyToken latest failed");

        // UPDATE (Token rotation)
        const newExpiresAt = new Date(Date.now() + 7200 * 1000);
        const rotated = await saveEtsyToken({
          shopId,
          accessToken: "rotated_access_token_abcde",
          refreshToken: "rotated_refresh_token_fghij",
          expiresAt: newExpiresAt,
          tokenType: "Bearer",
        });
        assert(rotated.id === created.id, "Rotated token should update existing record ID");
        assert(rotated.accessToken === "rotated_access_token_abcde", "Rotated access token mismatch");

        // DELETE
        await prisma.etsyToken.delete({ where: { id: created.id } });
        const postDelete = await prisma.etsyToken.findUnique({ where: { id: created.id } });
        assert(postDelete === null, "EtsyToken should be null after delete");
      },
      "HIGH"
    );

    // 2.5 EmailEvent CRUD
    await runTest(
      "T2.5",
      "EmailEvent CRUD",
      "Performs Create, Read, Update, Delete on EmailEvent",
      "EmailEvent created, queried, updated, and deleted",
      async () => {
        const parentOrderId = `${runPrefix}_ord_ee_parent`;
        cleanupOrderIds.push(parentOrderId);

        await createOrder({
          id: parentOrderId,
          customerEmail: "email_crud@example.com",
          frameSize: "11x14",
          palette: "ocean_navy",
          audioPath: "storage/uploads/email_crud.wav",
          totalAmount: 6900,
          resendEmailId: `re_${runPrefix}_ee_1`,
        });

        // CREATE
        const event = await recordEmailEvent({
          orderId: parentOrderId,
          resendEmailId: `re_${runPrefix}_ee_1`,
          eventType: "email.delivered",
          recipient: "email_crud@example.com",
          subject: "Your SoundWave Art Print is Confirmed!",
          payload: { deliveryTime: new Date().toISOString(), smtpId: "smtp_123" },
        });
        cleanupEmailIds.push(event.id);
        assert(event.orderId === parentOrderId, "EmailEvent orderId mismatch");
        assert(event.eventType === "email.delivered", "EmailEvent eventType mismatch");

        // READ via helper
        const events = await getEmailEvents(parentOrderId);
        assert(events.length === 1 && events[0].id === event.id, "getEmailEvents read failed");

        // UPDATE
        const updated = await prisma.emailEvent.update({
          where: { id: event.id },
          data: { bounceReason: "none" },
        });
        assert(updated.bounceReason === "none", "EmailEvent update failed");

        // Also test updateOrderEmailStatus helper
        const updatedOrder = await updateOrderEmailStatus(parentOrderId, "delivered");
        assert(updatedOrder !== null && updatedOrder.emailStatus === "delivered", "updateOrderEmailStatus failed");

        // DELETE
        await prisma.emailEvent.delete({ where: { id: event.id } });
        const postDelete = await prisma.emailEvent.findUnique({ where: { id: event.id } });
        assert(postDelete === null, "EmailEvent should be null after delete");

        await prisma.order.delete({ where: { id: parentOrderId } });
      },
      "HIGH"
    );

    // =========================================================================
    // 3. FOREIGN KEY CASCADES & CONSTRAINT ENFORCEMENT
    // =========================================================================
    console.log("\n>>> SUITE 3: Foreign Key Cascades & Constraint Enforcement");

    await runTest(
      "T3.1",
      "Constraints",
      "Rejects FulfillmentLog with non-existent foreign key orderId",
      "Prisma throws foreign key violation error (P2003)",
      async () => {
        let threw = false;
        try {
          await addFulfillmentLog(`non_existent_ord_${Date.now()}`, "test_step", "failed", "Invalid FK test");
        } catch (err: any) {
          threw = true;
          assert(
            err.code === "P2003" || err.message.toLowerCase().includes("foreign key"),
            `Expected P2003 foreign key violation, got ${err.code}: ${err.message}`
          );
        }
        assert(threw, "FulfillmentLog insertion with non-existent orderId must fail");
      },
      "HIGH"
    );

    await runTest(
      "T3.2",
      "Constraints",
      "Rejects EmailEvent with invalid non-null orderId but allows orderId = null",
      "Invalid FK throws P2003; null FK succeeds",
      async () => {
        let threw = false;
        try {
          await recordEmailEvent({
            orderId: `non_existent_ord_${Date.now()}`,
            resendEmailId: `re_invalid_${Date.now()}`,
            eventType: "email.bounced",
            recipient: "nonexistent@example.com",
          });
        } catch (err: any) {
          threw = true;
          assert(
            err.code === "P2003" || err.message.toLowerCase().includes("foreign key"),
            `Expected P2003 foreign key violation, got ${err.code}: ${err.message}`
          );
        }
        assert(threw, "EmailEvent insertion with non-existent orderId must fail");

        // Null FK must succeed (orderId is optional in EmailEvent)
        const unlinkedEvent = await recordEmailEvent({
          orderId: null,
          resendEmailId: `re_unlinked_${runPrefix}`,
          eventType: "email.sent",
          recipient: "unlinked@example.com",
          subject: "Unlinked System Email",
        });
        cleanupEmailIds.push(unlinkedEvent.id);
        assert(unlinkedEvent.orderId === null, "EmailEvent with null orderId succeeded");

        await prisma.emailEvent.delete({ where: { id: unlinkedEvent.id } });
      },
      "HIGH"
    );

    await runTest(
      "T3.3",
      "Cascades",
      "Empirical check of PostgreSQL delete_rule and cascade behavior on Order deletion",
      "FulfillmentLogs cascade deleted; EmailEvent delete_rule verified",
      async () => {
        const fkRules: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            tc.table_name, 
            kcu.column_name, 
            rc.delete_rule 
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public';
        `);

        console.log("    PostgreSQL Foreign Key delete_rules:", JSON.stringify(fkRules));

        const flogFk = fkRules.find((r) => r.table_name === "FulfillmentLog");
        assert(flogFk && flogFk.delete_rule === "CASCADE", "FulfillmentLog FK must have delete_rule CASCADE");

        const emailFk = fkRules.find((r) => r.table_name === "EmailEvent");
        assert(emailFk !== undefined, "EmailEvent must have a foreign key constraint to Order");

        // Test live deletion behavior
        const cascadeOrderId = `${runPrefix}_ord_cascade`;
        await createOrder({
          id: cascadeOrderId,
          customerEmail: "cascade_test@example.com",
          frameSize: "16x20",
          palette: "midnight_gold",
          audioPath: "storage/uploads/casc.wav",
          totalAmount: 9900,
        });

        // Add 3 FulfillmentLogs
        await addFulfillmentLog(cascadeOrderId, "step_1", "success", "Log 1");
        await addFulfillmentLog(cascadeOrderId, "step_2", "success", "Log 2");
        await addFulfillmentLog(cascadeOrderId, "step_3", "success", "Log 3");

        // Add 1 EmailEvent
        const emailEvt = await recordEmailEvent({
          orderId: cascadeOrderId,
          resendEmailId: `re_casc_${runPrefix}`,
          eventType: "email.delivered",
          recipient: "cascade_test@example.com",
        });

        const logsBefore = await getFulfillmentLogs(cascadeOrderId);
        assert(logsBefore.length === 3, "All 3 logs exist before order deletion");

        // Delete Order
        await prisma.order.delete({ where: { id: cascadeOrderId } });

        // Verify Order is gone
        const orderAfter = await getOrderById(cascadeOrderId);
        assert(orderAfter === null, "Order is deleted");

        // Verify FulfillmentLogs were cascaded
        const logsAfter = await getFulfillmentLogs(cascadeOrderId);
        assert(logsAfter.length === 0, `Expected 0 fulfillment logs after cascade, found ${logsAfter.length}`);

        // Verify EmailEvent state
        const emailAfter = await prisma.emailEvent.findUnique({ where: { id: emailEvt.id } });
        console.log(
          `    EmailEvent state after order deletion (schema delete_rule=${emailFk.delete_rule}):`,
          emailAfter === null ? "DELETED (Cascade)" : `RETAINED (orderId=${emailAfter.orderId})`
        );

        if (emailFk.delete_rule === "CASCADE") {
          assert(emailAfter === null, "EmailEvent was CASCADE deleted");
        } else if (emailFk.delete_rule === "SET NULL") {
          assert(emailAfter !== null && emailAfter.orderId === null, "EmailEvent orderId was SET NULL");
          await prisma.emailEvent.delete({ where: { id: emailEvt.id } });
        }
      },
      "HIGH"
    );

    await runTest(
      "T3.4",
      "Unique Constraints",
      "Enforces unique constraints on Order stripeSessionId, externalOrderId, and resendEmailId",
      "Duplicate values throw unique constraint violation (P2002)",
      async () => {
        const baseOrderId = `${runPrefix}_ord_uniq_base`;
        cleanupOrderIds.push(baseOrderId);

        await createOrder({
          id: baseOrderId,
          customerEmail: "uniq@example.com",
          frameSize: "8x10",
          palette: "midnight_gold",
          audioPath: "storage/uploads/uniq.wav",
          totalAmount: 4900,
          stripeSessionId: `cs_uniq_${runPrefix}`,
          externalOrderId: `etsy_uniq_${runPrefix}`,
          resendEmailId: `re_uniq_${runPrefix}`,
        });

        // 1. Duplicate stripeSessionId
        let dupStripe = false;
        try {
          await createOrder({
            id: `${runPrefix}_ord_dup_stripe`,
            customerEmail: "dup_stripe@example.com",
            frameSize: "8x10",
            palette: "midnight_gold",
            audioPath: "storage/uploads/dup.wav",
            totalAmount: 4900,
            stripeSessionId: `cs_uniq_${runPrefix}`,
          });
        } catch (err: any) {
          dupStripe = true;
          assert(err.code === "P2002", `Expected P2002, got ${err.code}`);
        }
        assert(dupStripe, "Duplicate stripeSessionId must be rejected");

        // 2. Duplicate externalOrderId
        let dupExternal = false;
        try {
          await createOrder({
            id: `${runPrefix}_ord_dup_ext`,
            customerEmail: "dup_ext@example.com",
            frameSize: "8x10",
            palette: "midnight_gold",
            audioPath: "storage/uploads/dup.wav",
            totalAmount: 4900,
            externalOrderId: `etsy_uniq_${runPrefix}`,
          });
        } catch (err: any) {
          dupExternal = true;
          assert(err.code === "P2002", `Expected P2002, got ${err.code}`);
        }
        assert(dupExternal, "Duplicate externalOrderId must be rejected");

        // 3. Duplicate resendEmailId
        let dupResend = false;
        try {
          await createOrder({
            id: `${runPrefix}_ord_dup_resend`,
            customerEmail: "dup_resend@example.com",
            frameSize: "8x10",
            palette: "midnight_gold",
            audioPath: "storage/uploads/dup.wav",
            totalAmount: 4900,
            resendEmailId: `re_uniq_${runPrefix}`,
          });
        } catch (err: any) {
          dupResend = true;
          assert(err.code === "P2002", `Expected P2002, got ${err.code}`);
        }
        assert(dupResend, "Duplicate resendEmailId must be rejected");

        await prisma.order.delete({ where: { id: baseOrderId } });
      },
      "HIGH"
    );

    // =========================================================================
    // 4. CONCURRENT TRANSACTIONS & RAPID INSERTIONS
    // =========================================================================
    console.log("\n>>> SUITE 4: High-Concurrency Stress Testing & Atomic Transactions");

    // 4.1 Rapid concurrent Order creations (50 orders batched safely across pooled client)
    await runTest(
      "T4.1",
      "Concurrency",
      "50 rapid concurrent Order creations with unique IDs and session tokens",
      "All 50 orders created cleanly and verified in PostgreSQL",
      async () => {
        const count = 50;
        // Run in batches of 10 to simulate rapid sustained bursts within connection pool bounds
        const batchSize = 10;
        const createdIds: string[] = [];

        for (let b = 0; b < count; b += batchSize) {
          const batchPromises = Array.from({ length: batchSize }, (_, i) => {
            const idx = b + i;
            const ordId = `${runPrefix}_ord_conc_${idx}`;
            cleanupOrderIds.push(ordId);
            return pooledPrisma.order.create({
              data: {
                id: ordId,
                customerEmail: `conc_${idx}@stress.com`,
                shippingName: `Concurrency User ${idx}`,
                shippingAddress: `${idx} Thread Lane, Unit ${idx}, Concurrency City, CA 94107`,
                frameSize: idx % 2 === 0 ? "16x20" : "24x36",
                palette: idx % 2 === 0 ? "midnight_gold" : "ocean_navy",
                caption: `Rapid Order #${idx} [${runPrefix}]`,
                audioPath: `storage/uploads/audio_${idx}.wav`,
                totalAmount: 9900 + idx * 100,
                stripeSessionId: `cs_${runPrefix}_conc_${idx}`,
              },
            });
          });
          const batchRes = await Promise.all(batchPromises);
          createdIds.push(...batchRes.map((o) => o.id));
        }

        assert(createdIds.length === count, `Expected ${count} orders created, got ${createdIds.length}`);

        const fetched = await pooledPrisma.order.findMany({
          where: { id: { in: createdIds } },
        });
        assert(fetched.length === count, `Expected ${count} orders retrieved from PostgreSQL, found ${fetched.length}`);

        await pooledPrisma.order.deleteMany({
          where: { id: { in: createdIds } },
        });
      },
      "HIGH"
    );

    // 4.2 Webhook event idempotency storm
    await runTest(
      "T4.2",
      "Concurrency",
      "50 concurrent WebhookEvent upsert requests for the identical eventId (idempotency storm)",
      "Exactly 1 row created, status marked processed, zero duplicates",
      async () => {
        const stormEventId = `evt_storm_${runPrefix}`;
        cleanupWebhookIds.push(stormEventId);

        const payload = JSON.stringify({
          eventId: stormEventId,
          type: "checkout.session.completed",
          timestamp: Date.now(),
        });

        // Execute in 5 parallel batches of 10
        for (let b = 0; b < 50; b += 10) {
          const promises = Array.from({ length: 10 }, () =>
            pooledPrisma.webhookEvent.upsert({
              where: { eventId: stormEventId },
              create: {
                eventId: stormEventId,
                eventType: "checkout.session.completed",
                status: "processed",
                payload,
                processedAt: new Date(),
              },
              update: {
                status: "processed",
                payload,
                processedAt: new Date(),
              },
            })
          );
          await Promise.all(promises);
        }

        const records = await pooledPrisma.webhookEvent.findMany({
          where: { eventId: stormEventId },
        });
        assert(
          records.length === 1,
          `Expected exactly 1 WebhookEvent record for eventId, found ${records.length}`
        );
        assert(records[0].status === "processed", "Record status is processed");

        await pooledPrisma.webhookEvent.delete({ where: { eventId: stormEventId } });
      },
      "HIGH"
    );

    // 4.3 Concurrent fulfillment logs to single order
    await runTest(
      "T4.3",
      "Concurrency",
      "25 concurrent fulfillment logs written to the SAME order row",
      "All 25 logs persisted without foreign key lock collisions",
      async () => {
        const orderId = `${runPrefix}_ord_conc_logs`;
        cleanupOrderIds.push(orderId);

        await pooledPrisma.order.create({
          data: {
            id: orderId,
            customerEmail: "conc_logs@stress.com",
            frameSize: "8x10",
            palette: "midnight_gold",
            audioPath: "storage/uploads/conc_logs.wav",
            totalAmount: 4900,
          },
        });

        for (let b = 0; b < 25; b += 5) {
          const logPromises = Array.from({ length: 5 }, (_, i) => {
            const idx = b + i;
            return pooledPrisma.fulfillmentLog.create({
              data: {
                orderId,
                step: `step_${idx % 5}`,
                status: "success",
                details: `Concurrent log detail ${idx}`,
              },
            });
          });
          await Promise.all(logPromises);
        }

        const fetchedLogs = await pooledPrisma.fulfillmentLog.findMany({ where: { orderId } });
        assert(fetchedLogs.length === 25, `Expected 25 logs retrieved, got ${fetchedLogs.length}`);

        await pooledPrisma.order.delete({ where: { id: orderId } });
      },
      "HIGH"
    );

    // 4.4 Racing status updates on same order
    await runTest(
      "T4.4",
      "Concurrency",
      "20 concurrent status transitions racing on the SAME Order record",
      "All 20 updates succeed without deadlocks; final record in valid state",
      async () => {
        const targetId = `${runPrefix}_ord_race`;
        cleanupOrderIds.push(targetId);

        await pooledPrisma.order.create({
          data: {
            id: targetId,
            customerEmail: "race@stress.com",
            frameSize: "16x20",
            palette: "midnight_gold",
            audioPath: "storage/uploads/race.wav",
            totalAmount: 9900,
          },
        });

        const statuses = [
          "pending_fulfillment",
          "fulfillment_submitted",
          "shipped",
          "delivered",
        ];

        for (let b = 0; b < 20; b += 5) {
          const updates = Array.from({ length: 5 }, (_, i) => {
            const idx = b + i;
            const st = statuses[idx % statuses.length];
            return pooledPrisma.order.update({
              where: { id: targetId },
              data: {
                status: st,
                partnerOrderId: `partner_race_${idx}`,
                shippingName: `Recipient ${idx}`,
              },
            });
          });
          await Promise.all(updates);
        }

        const finalOrder = await pooledPrisma.order.findUnique({ where: { id: targetId } });
        assert(finalOrder !== null, "Final order retrievable");
        assert(statuses.includes(finalOrder!.status), `Final status ${finalOrder?.status} valid`);

        await pooledPrisma.order.delete({ where: { id: targetId } });
      },
      "HIGH"
    );

    // 4.5 Atomic multi-table transactions
    await runTest(
      "T4.5",
      "Atomic Transactions",
      "Verifies multi-model atomic commit and rollback with prisma.$transaction",
      "Committed transaction persists all records; failed transaction rolls back all",
      async () => {
        const txOrderId = `${runPrefix}_ord_tx_commit`;
        cleanupOrderIds.push(txOrderId);

        // 1. Successful commit
        await pooledPrisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              id: txOrderId,
              customerEmail: "tx_commit@example.com",
              frameSize: "11x14",
              palette: "nordic_slate",
              audioPath: "storage/uploads/tx.wav",
              totalAmount: 6900,
            },
          });

          await tx.fulfillmentLog.create({
            data: {
              orderId: txOrderId,
              step: "transaction_verification",
              status: "success",
            },
          });

          await tx.emailEvent.create({
            data: {
              orderId: txOrderId,
              resendEmailId: `re_tx_${runPrefix}`,
              eventType: "email.sent",
              recipient: "tx_commit@example.com",
            },
          });
        });

        const orderCommitted = await pooledPrisma.order.findUnique({ where: { id: txOrderId } });
        assert(orderCommitted !== null, "Committed order exists");
        const logsCommitted = await pooledPrisma.fulfillmentLog.findMany({ where: { orderId: txOrderId } });
        assert(logsCommitted.length === 1, "Committed log exists");

        // 2. Transaction Rollback on error
        const rollOrderId = `${runPrefix}_ord_tx_rollback`;
        let rollbackCaught = false;
        try {
          await pooledPrisma.$transaction(async (tx) => {
            await tx.order.create({
              data: {
                id: rollOrderId,
                customerEmail: "tx_rollback@example.com",
                frameSize: "8x10",
                palette: "midnight_gold",
                audioPath: "storage/uploads/roll.wav",
                totalAmount: 4900,
              },
            });

            throw new Error("Deliberate abort inside transaction to test rollback");
          });
        } catch (err: any) {
          rollbackCaught = true;
          assert(err.message.includes("Deliberate abort"), "Caught expected abort error");
        }
        assert(rollbackCaught, "Transaction threw error");

        const orderRollback = await pooledPrisma.order.findUnique({ where: { id: rollOrderId } });
        assert(orderRollback === null, "Rolled-back order must NOT exist in database");

        await pooledPrisma.order.delete({ where: { id: txOrderId } });
      },
      "CRITICAL"
    );

    // =========================================================================
    // 5. SQLITE PRAGMA VERIFICATION & DIALECT SAFETY
    // =========================================================================
    console.log("\n>>> SUITE 5: SQLite PRAGMA Verification & PostgreSQL Dialect Safety");

    await runTest(
      "T5.1",
      "Dialect Safety",
      "ensurePragmas() runs cleanly without executing SQLite PRAGMAs on PostgreSQL",
      "ensurePragmas resolves without errors or raw PRAGMA execution",
      async () => {
        await ensurePragmas();
        await Promise.all([ensurePragmas(), ensurePragmas(), ensurePragmas()]);
        assert(true, "ensurePragmas executed without throwing");
      },
      "CRITICAL"
    );

    await runTest(
      "T5.2",
      "Dialect Safety",
      "Empirically proves raw SQLite PRAGMA fails on Supabase PostgreSQL (validating guard necessity)",
      "Direct PRAGMA query against PostgreSQL throws syntax error (42601)",
      async () => {
        let threw = false;
        try {
          await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
        } catch (err: any) {
          threw = true;
          assert(
            err.message.toLowerCase().includes("syntax error") ||
              err.message.includes("42601") ||
              err.message.toLowerCase().includes("pragma"),
            `Expected PostgreSQL syntax error on PRAGMA, got: ${err.message}`
          );
        }
        assert(threw, "PostgreSQL must reject SQLite PRAGMA with syntax error");
      },
      "HIGH"
    );

    // =========================================================================
    // 6. UNICODE, LARGE PAYLOADS & DATA INTEGRITY
    // =========================================================================
    console.log("\n>>> SUITE 6: Unicode, Large Payloads & Data Integrity");

    await runTest(
      "T6.1",
      "Unicode Integrity",
      "Persists complex multilingual text, RTL Arabic/Hebrew, Zalgo, and Emoji",
      "PostgreSQL stores and retrieves Unicode characters with exact fidelity",
      async () => {
        const orderId = `${runPrefix}_ord_unicode`;
        cleanupOrderIds.push(orderId);

        const caption = "💍 Wedding Vows: Sarah & David ❤️ 🎶 👨‍👩‍👧‍👦 我们的第一首歌 أغنيتنا שיר החתונה 𝄞";
        const personalization = JSON.stringify({
          songTitle: "愛的羅曼史 — Romance de Amor 🎸",
          notes: "Special dedication: Für Elise & Moonlight Sonata 🌙",
        });

        await createOrder({
          id: orderId,
          customerEmail: "unicode@example.com",
          frameSize: "16x20",
          palette: "midnight_gold",
          caption,
          personalizationData: personalization,
          audioPath: "storage/uploads/unicode.wav",
          totalAmount: 9900,
        });

        const fetched = await getOrderById(orderId);
        assert(fetched !== null, "Unicode order retrieved");
        assert(fetched?.caption === caption, `Caption mismatch: ${fetched?.caption} vs ${caption}`);
        assert(
          fetched?.personalizationData === personalization,
          "Personalization data Unicode mismatch"
        );

        await prisma.order.delete({ where: { id: orderId } });
      },
      "HIGH"
    );

    await runTest(
      "T6.2",
      "Large Payload",
      "Stores and retrieves 100KB nested JSON payload in WebhookEvent",
      "100KB payload stored in PostgreSQL TEXT column without truncation",
      async () => {
        const eventId = `evt_large_${runPrefix}`;
        cleanupWebhookIds.push(eventId);

        const bigPayload: Record<string, any> = {
          batchId: runPrefix,
          items: [],
        };
        for (let i = 0; i < 400; i++) {
          bigPayload.items.push({
            id: i,
            name: `Order Item ${i}`,
            notes: "X".repeat(200),
            metadata: { tag: `tag_${i}`, score: i * 1.5 },
          });
        }

        const rawJson = JSON.stringify(bigPayload);
        assert(rawJson.length >= 100000, `Payload length should be >= 100KB, got ${rawJson.length}`);

        await recordWebhookEvent(eventId, "batch.processed", "processed", bigPayload);

        const fetched = await prisma.webhookEvent.findUnique({ where: { eventId } });
        assert(fetched !== null, "Large webhook event retrievable");
        assert(fetched!.payload.length === rawJson.length, "Payload length preserved exactly");

        const parsed = JSON.parse(fetched!.payload);
        assert(parsed.items.length === 400, "All 400 nested items retrieved");

        await prisma.webhookEvent.delete({ where: { eventId } });
      },
      "MEDIUM"
    );
  } finally {
    console.log("\n>>> TEARDOWN: Cleaning up any remaining test artifacts...");
    try {
      if (cleanupOrderIds.length > 0) {
        await pooledPrisma.order.deleteMany({ where: { id: { in: cleanupOrderIds } } });
      }
      if (cleanupWebhookIds.length > 0) {
        await pooledPrisma.webhookEvent.deleteMany({ where: { eventId: { in: cleanupWebhookIds } } });
      }
      if (cleanupEtsyIds.length > 0) {
        await pooledPrisma.etsyToken.deleteMany({ where: { id: { in: cleanupEtsyIds } } });
      }
      if (cleanupEmailIds.length > 0) {
        await pooledPrisma.emailEvent.deleteMany({ where: { id: { in: cleanupEmailIds } } });
      }
    } catch (cleanupErr) {
      console.warn("Teardown warning:", cleanupErr);
    }
    await prisma.$disconnect();
    await pooledPrisma.$disconnect();
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n================================================================================");
  console.log("   EMPIRICAL CHALLENGE SUITE SUMMARY");
  console.log("================================================================================");

  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;

  console.log(`Total empirical tests: ${total}`);
  console.log(`Passed:                ${passed}`);
  console.log(`Failed:                ${failed}`);
  console.log("================================================================================\n");

  for (const r of reports) {
    const mark = r.passed ? "[PASS]" : `[FAIL - ${r.severity}]`;
    console.log(`${mark} ${r.id} (${r.category}): ${r.name} [${r.durationMs}ms]`);
    if (!r.passed) {
      console.log(`    Expected: ${r.expected}`);
      console.log(`    Actual:   ${r.actual.split("\n")[0]}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\nALL EMPIRICAL TESTS EXECUTED AND PASSED.");
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
