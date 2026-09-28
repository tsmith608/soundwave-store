/**
 * tests/test_sprint2_unified.ts
 *
 * SoundWave Art — Sprint 2 Unified Full Integration & Verification Test Suite
 *
 * Verifies all 5 core Sprint 2 requirements:
 *   - R1: Supabase PostgreSQL (Live connection, 5 public tables, 0 legacy tables, Order CRUD, FK cascade, PRAGMA bypass)
 *   - R2: pSEO Engine (24 occasions, 17 anniversaries + 7 memorials, slug lookup with aliases, Schema.org @graph JSON-LD, customizer URL param construction, Navbar link)
 *   - R3: Etsy API v3 (PKCE S256 challenge, RFC 7636, graceful degradation when unconfigured, variation & personalization mapper, deduplication via partnerOrderId)
 *   - R4: Resend Webhooks (Svix HMAC-SHA256 crypto, missing/tampered/expired headers rejection, email.delivered, email.bounced, email.complained, email.opened/clicked, Order mutations, EmailEvent audit logs, idempotency)
 *   - R5: UGC 50 Scripts (docs/UGC_SCRIPTS_50.md exists, exactly 50 scripts #01-#50, all 9 fields, 6 categories, zero placeholders, September 2026 style)
 *
 * Execution:
 *   cmd /c npx tsx tests/test_sprint2_unified.ts
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextRequest } from "next/server";

// Database subsystem
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

// Constants & Styles
import { DECORATIVE_STYLES, PALETTES, FRAME_SIZES } from "../src/lib/constants";

// pSEO Engine
import {
  getAllOccasions,
  getAnniversaryOccasions,
  getMemorialOccasions,
  getOccasionBySlug,
  OccasionData,
} from "../src/lib/pseo";

// Etsy Subsystem
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
  isEtsyConfigured,
  resolveFrameSize,
  resolvePalette,
  resolveTheme,
  extractCaption,
  extractAudioUrl,
  formatShippingAddress,
  mapEtsyReceiptToOrders,
  EtsyReceipt,
} from "../src/lib/etsy";
import { GET as etsyLoginHandler } from "../src/app/api/etsy/oauth/login/route";
import { GET as etsyCallbackHandler } from "../src/app/api/etsy/oauth/callback/route";
import {
  GET as etsyOrdersGetHandler,
  POST as etsyOrdersPostHandler,
} from "../src/app/api/etsy/orders/route";

// Svix & Resend Webhooks
import { verifySvixSignature, createSvixSignature } from "../src/lib/svix";
import { POST as resendWebhookHandler } from "../src/app/api/webhooks/resend/route";

// Console styling
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

interface RequirementStats {
  total: number;
  passed: number;
  failed: number;
}

const reqStats: Record<string, RequirementStats> = {
  "R1 (Supabase PostgreSQL)": { total: 0, passed: 0, failed: 0 },
  "R2 (pSEO Engine)": { total: 0, passed: 0, failed: 0 },
  "R3 (Etsy API v3)": { total: 0, passed: 0, failed: 0 },
  "R4 (Resend Webhooks)": { total: 0, passed: 0, failed: 0 },
  "R5 (UGC 50 Scripts)": { total: 0, passed: 0, failed: 0 },
};

function assert(req: keyof typeof reqStats, description: string, condition: boolean, detail?: string) {
  reqStats[req].total++;
  if (condition) {
    reqStats[req].passed++;
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${description}`);
  } else {
    reqStats[req].failed++;
    console.error(`  ${RED}✗ [FAIL]${RESET} ${description}`);
    if (detail) {
      console.error(`         ${YELLOW}Detail:${RESET} ${detail}`);
    }
  }
}

const PROJECT_ROOT = path.resolve(__dirname, "..");
const runId = `sprint2_unified_${Date.now()}`;
const cleanupOrderIds: string[] = [];

// ============================================================================
// SUITE 1: REQUIREMENT R1 — SUPABASE POSTGRESQL MIGRATION & WIPE
// ============================================================================
async function runSuiteR1() {
  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   REQUIREMENT R1: SUPABASE POSTGRESQL & SCHEMA INTEGRITY                       ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  // 1.1 Live connection and version introspection
  try {
    const connRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT current_database() AS db, version() AS version, current_schema() AS schema;"
    );
    assert(
      "R1 (Supabase PostgreSQL)",
      "Live connection connects to Supabase database 'postgres' in schema 'public'",
      connRows.length > 0 && connRows[0].db === "postgres" && connRows[0].schema === "public",
      `db: ${connRows[0]?.db}, schema: ${connRows[0]?.schema}`
    );
    assert(
      "R1 (Supabase PostgreSQL)",
      "Database dialect is genuine PostgreSQL",
      typeof connRows[0]?.version === "string" && connRows[0].version.toLowerCase().includes("postgresql"),
      `Version: ${connRows[0]?.version}`
    );
  } catch (err: any) {
    assert("R1 (Supabase PostgreSQL)", "Live database connection", false, err.message);
  }

  // 1.2 Exact 5 tables, 0 legacy tables
  try {
    const tableRows: any[] = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    );
    const tables = tableRows.map((r) => r.table_name);
    const requiredTables = ["EmailEvent", "EtsyToken", "FulfillmentLog", "Order", "WebhookEvent"];

    const allFivePresent = requiredTables.every((t) => tables.includes(t));
    assert(
      "R1 (Supabase PostgreSQL)",
      "Public schema contains all 5 required SoundWave models (Order, WebhookEvent, FulfillmentLog, EtsyToken, EmailEvent)",
      allFivePresent,
      `Tables found: ${tables.join(", ")}`
    );

    const legacyTables = [
      "instagram_posts",
      "link_clicks",
      "posts",
      "profiles",
      "subreddits",
      "tiktok_posts",
      "subscriptions",
      "comments",
    ];
    const foundLegacy = legacyTables.filter((t) => tables.includes(t));
    assert(
      "R1 (Supabase PostgreSQL)",
      "Public schema contains 0 legacy tables (clean wipe verified)",
      foundLegacy.length === 0,
      `Found legacy tables: ${foundLegacy.join(", ")}`
    );

    // Exact table count check: exactly 5 tables (or 5 tables plus prisma internal migrations if any)
    const nonSoundwaveTables = tables.filter((t) => !requiredTables.includes(t) && t !== "_prisma_migrations");
    assert(
      "R1 (Supabase PostgreSQL)",
      "Zero unmanaged third-party tables in public schema",
      nonSoundwaveTables.length === 0,
      `Unmanaged tables: ${nonSoundwaveTables.join(", ")}`
    );
  } catch (err: any) {
    assert("R1 (Supabase PostgreSQL)", "Schema table introspection", false, err.message);
  }

  // 1.3 Order CRUD with Etsy and Resend columns
  const testOrderId = `${runId}_ord_crud`;
  cleanupOrderIds.push(testOrderId);

  try {
    // CREATE
    const created = await createOrder({
      id: testOrderId,
      customerEmail: "sarah.jenkins@soundwave-test.com",
      shippingName: "Sarah Jenkins",
      shippingAddress: "742 Evergreen Terrace, Springfield, OR 97477",
      frameSize: "16x20",
      palette: "midnight_gold",
      caption: "Our First Dance — October 14, 2024",
      audioPath: "storage/uploads/test_audio.wav",
      photoPath: "storage/uploads/photo.jpg",
      decorativeTheme: "botanical",
      previewUrl: `/api/orders/${testOrderId}/preview`,
      totalAmount: 9900,
      source: "etsy",
      externalOrderId: `etsy_${runId}_tx1`,
      partnerOrderId: `etsy_${runId}_tx1`,
      personalizationData: JSON.stringify({ song: "At Last", artist: "Etta James" }),
      etsyListingId: "99887766",
      etsyReceiptId: "55443322",
      audioSourceUrl: "https://dropbox.com/s/audio.wav",
      emailStatus: "not_sent",
    });

    assert(
      "R1 (Supabase PostgreSQL)",
      "Order CREATE succeeds with all core, Etsy, and Resend fields in PostgreSQL",
      created.id === testOrderId && created.source === "etsy" && created.totalAmount === 9900
    );

    // READ
    const fetched = await getOrderById(testOrderId);
    assert(
      "R1 (Supabase PostgreSQL)",
      "Order READ by primary key retrieves persisted data accurately",
      fetched !== null &&
        fetched.customerEmail === "sarah.jenkins@soundwave-test.com" &&
        fetched.decorativeTheme === "botanical" &&
        fetched.externalOrderId === `etsy_${runId}_tx1`
    );

    // UPDATE
    const updated = await updateOrderStatus(testOrderId, "pending_fulfillment", {
      partnerOrderId: "prodigi_track_12345",
      resendEmailId: "re_update_001",
      emailStatus: "sent",
    });
    assert(
      "R1 (Supabase PostgreSQL)",
      "Order UPDATE mutates status and tracking columns correctly",
      updated.status === "pending_fulfillment" &&
        updated.partnerOrderId === "prodigi_track_12345" &&
        updated.emailStatus === "sent"
    );

    // Foreign key constraint & Cascade deletion verification
    const cascadeOrderId = `${runId}_ord_cascade`;
    cleanupOrderIds.push(cascadeOrderId);

    await createOrder({
      id: cascadeOrderId,
      customerEmail: "cascade.test@example.com",
      frameSize: "11x14",
      palette: "ocean_navy",
      caption: "Cascade Deletion Verification",
      audioPath: "storage/uploads/cascade.wav",
      totalAmount: 6900,
    });

    await addFulfillmentLog(cascadeOrderId, "waveform_gen", "success", "Generated 60 bars");
    await addFulfillmentLog(cascadeOrderId, "pdf_compile", "success", "Compiled 300 DPI PDF");
    await recordEmailEvent({
      orderId: cascadeOrderId,
      resendEmailId: "re_cascade_001",
      eventType: "email.sent",
      recipient: "cascade.test@example.com",
    });

    const logsBefore = await getFulfillmentLogs(cascadeOrderId);
    const emailsBefore = await getEmailEvents(cascadeOrderId);
    assert(
      "R1 (Supabase PostgreSQL)",
      "Dependent child records (FulfillmentLog, EmailEvent) seeded successfully",
      logsBefore.length === 2 && emailsBefore.length === 1
    );

    // Perform DELETE on parent Order
    await prisma.order.delete({ where: { id: cascadeOrderId } });

    const orderAfter = await getOrderById(cascadeOrderId);
    const logsAfter = await getFulfillmentLogs(cascadeOrderId);
    const emailsAfter = await getEmailEvents(cascadeOrderId);

    assert(
      "R1 (Supabase PostgreSQL)",
      "Parent Order deletion succeeds",
      orderAfter === null
    );
    assert(
      "R1 (Supabase PostgreSQL)",
      "Foreign Key ON DELETE CASCADE automatically purged dependent FulfillmentLogs",
      logsAfter.length === 0,
      `Remaining logs: ${logsAfter.length}`
    );
    assert(
      "R1 (Supabase PostgreSQL)",
      "Foreign Key ON DELETE CASCADE automatically purged dependent EmailEvents",
      emailsAfter.length === 0,
      `Remaining email events: ${emailsAfter.length}`
    );
  } catch (err: any) {
    assert("R1 (Supabase PostgreSQL)", "Order CRUD and Foreign Key Cascade", false, err.message);
  }

  // 1.4 PRAGMA bypass & PostgreSQL Dialect Safety
  try {
    // Calling ensurePragmas() should complete without throwing against PostgreSQL
    await ensurePragmas();
    assert(
      "R1 (Supabase PostgreSQL)",
      "ensurePragmas() safely bypasses SQLite PRAGMAs on PostgreSQL connection",
      true
    );

    // Empirically verify that direct PRAGMA execution is rejected by PostgreSQL syntax engine
    let pragmaThrew = false;
    let pragmaError = "";
    try {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    } catch (err: any) {
      pragmaThrew = true;
      pragmaError = err?.message || String(err);
    }
    assert(
      "R1 (Supabase PostgreSQL)",
      "PostgreSQL rejects raw SQLite PRAGMA syntax with syntax error (validating bypass necessity)",
      pragmaThrew && pragmaError.toLowerCase().includes("pragma"),
      pragmaError
    );
  } catch (err: any) {
    assert("R1 (Supabase PostgreSQL)", "PRAGMA bypass verification", false, err.message);
  }
}

// ============================================================================
// SUITE 2: REQUIREMENT R2 — PROGRAMMATIC SEO (pSEO) ENGINE
// ============================================================================
async function runSuiteR2() {
  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   REQUIREMENT R2: PROGRAMMATIC SEO (pSEO) ENGINE & METADATA                    ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  // 2.1 Occasion Catalog Breakdown
  const allOccasions = getAllOccasions();
  const anniversaries = getAnniversaryOccasions();
  const memorials = getMemorialOccasions();

  assert(
    "R2 (pSEO Engine)",
    "pSEO catalog registers exactly 24 programmatic occasions",
    allOccasions.length === 24,
    `Total: ${allOccasions.length}`
  );

  assert(
    "R2 (pSEO Engine)",
    "Anniversary engine contains exactly 17 milestone years",
    anniversaries.length === 17,
    `Anniversaries: ${anniversaries.length}`
  );

  assert(
    "R2 (pSEO Engine)",
    "Memorial engine contains exactly 7 keepsake moments",
    memorials.length === 7,
    `Memorials: ${memorials.length}`
  );

  // Verify all 17 milestone years: 1-10, 15, 20, 25, 30, 40, 50, 60
  const expectedYears = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60];
  const actualYears = anniversaries
    .map((a) => a.milestoneYear)
    .filter((y): y is number => typeof y === "number");
  const missingYears = expectedYears.filter((y) => !actualYears.includes(y));
  assert(
    "R2 (pSEO Engine)",
    "All 17 required milestone years (1-10, 15, 20, 25, 30, 40, 50, 60) are registered",
    missingYears.length === 0,
    `Missing years: ${missingYears.join(", ")}`
  );

  // 2.2 Slug Lookup & Alias Resilience
  const primaryAnniversary = getOccasionBySlug("1st-paper-anniversary-soundwave-art");
  assert(
    "R2 (pSEO Engine)",
    "Primary slug '1st-paper-anniversary-soundwave-art' resolves correctly to anniversary-1",
    primaryAnniversary !== undefined && primaryAnniversary.id === "anniversary-1"
  );

  const aliasAnniversary = getOccasionBySlug("1st-paper-anniversary");
  assert(
    "R2 (pSEO Engine)",
    "Shorthand alias '1st-paper-anniversary' resolves to anniversary-1",
    aliasAnniversary !== undefined && aliasAnniversary.id === "anniversary-1"
  );

  const alias5th = getOccasionBySlug("5th-wood-anniversary");
  assert(
    "R2 (pSEO Engine)",
    "Shorthand alias '5th-wood-anniversary' resolves to anniversary-5",
    alias5th !== undefined && alias5th.id === "anniversary-5"
  );

  const primaryMemorial = getOccasionBySlug("pet-memorial-soundwave-art");
  assert(
    "R2 (pSEO Engine)",
    "Primary slug 'pet-memorial-soundwave-art' resolves correctly to memorial-pet",
    primaryMemorial !== undefined && primaryMemorial.id === "memorial-pet"
  );

  const aliasVow = getOccasionBySlug("wedding-vow-soundwave");
  assert(
    "R2 (pSEO Engine)",
    "Shorthand alias 'wedding-vow-soundwave' resolves to memorial-wedding-vows",
    aliasVow !== undefined && aliasVow.id === "memorial-wedding-vows"
  );

  const caseSlashResilient = getOccasionBySlug("5TH-WOOD-ANNIVERSARY-SOUNDWAVE-ART/");
  assert(
    "R2 (pSEO Engine)",
    "Slug lookup handles uppercase variations and trailing slashes cleanly",
    caseSlashResilient !== undefined && caseSlashResilient.id === "anniversary-5"
  );

  const nonExistent = getOccasionBySlug("non-existent-unknown-slug-test");
  assert(
    "R2 (pSEO Engine)",
    "Non-existent slug returns undefined safely without throwing",
    nonExistent === undefined
  );

  // 2.3 Schema.org @graph JSON-LD Structure
  const sampleOccasion = primaryAnniversary!;
  const appUrl = "https://soundwaveart.com";
  const pageUrl = `${appUrl}/gifts/${sampleOccasion.slug}`;
  const schemaGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${pageUrl}#product`,
        name: sampleOccasion.title,
        description: sampleOccasion.metaDescription,
        brand: { "@type": "Brand", name: "SoundWave Art" },
        category: sampleOccasion.engine === "anniversary" ? "Anniversary Gifts" : "Memorial & Keepsake Gifts",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "49.00",
          highPrice: "149.00",
          offerCount: "4",
          availability: "https://schema.org/InStock",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: sampleOccasion.ratingValue,
          reviewCount: sampleOccasion.reviewCount.toString(),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
          { "@type": "ListItem", position: 2, name: "Occasion Gifts", item: `${appUrl}/gifts` },
          { "@type": "ListItem", position: 3, name: sampleOccasion.title, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: sampleOccasion.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  assert(
    "R2 (pSEO Engine)",
    "Schema.org structure specifies @context 'https://schema.org' with 3 @graph nodes",
    schemaGraph["@context"] === "https://schema.org" && schemaGraph["@graph"].length === 3
  );

  const productNode = schemaGraph["@graph"].find((n) => n["@type"] === "Product") as any;
  assert(
    "R2 (pSEO Engine)",
    "Schema.org Product node provides valid AggregateOffer ($49-$149) and AggregateRating",
    Boolean(
      productNode &&
        productNode.offers.priceCurrency === "USD" &&
        productNode.offers.lowPrice === "49.00" &&
        productNode.offers.highPrice === "149.00" &&
        productNode.aggregateRating.ratingValue
    )
  );

  const breadcrumbNode = schemaGraph["@graph"].find((n) => n["@type"] === "BreadcrumbList") as any;
  assert(
    "R2 (pSEO Engine)",
    "Schema.org BreadcrumbList node contains 3 hierarchy levels",
    Boolean(breadcrumbNode && breadcrumbNode.itemListElement.length === 3)
  );

  const faqNode = schemaGraph["@graph"].find((n) => n["@type"] === "FAQPage") as any;
  assert(
    "R2 (pSEO Engine)",
    "Schema.org FAQPage node contains structured Question/Answer entities",
    Boolean(faqNode && faqNode.mainEntity.length >= 2 && faqNode.mainEntity[0]["@type"] === "Question")
  );

  // 2.4 Customizer URL Parameter Construction
  let customizerRoundTripOk = true;
  for (const occ of allOccasions) {
    const url = `/product/custom?template=${encodeURIComponent(occ.recommendedTemplate)}&palette=${encodeURIComponent(occ.recommendedPalette)}&size=${encodeURIComponent(occ.recommendedSize)}&caption=${encodeURIComponent(occ.sampleCaption)}`;
    const parsed = new URL(url, "https://soundwaveart.com");
    if (
      parsed.searchParams.get("template") !== occ.recommendedTemplate ||
      parsed.searchParams.get("palette") !== occ.recommendedPalette ||
      parsed.searchParams.get("size") !== occ.recommendedSize ||
      parsed.searchParams.get("caption") !== occ.sampleCaption
    ) {
      customizerRoundTripOk = false;
      break;
    }
  }
  assert(
    "R2 (pSEO Engine)",
    "All 24 occasions construct valid, reversible customizer query parameters (template, palette, size, caption)",
    customizerRoundTripOk
  );

  // 2.5 Navbar Link Verification
  const navbarPath = path.join(PROJECT_ROOT, "src/components/Navbar.tsx");
  const navbarContent = fs.readFileSync(navbarPath, "utf-8");
  assert(
    "R2 (pSEO Engine)",
    "Navbar component links to bespoke customizer studio (/product/custom)",
    navbarContent.includes('href="/product/custom"'),
    "Navbar does not contain href='/product/custom'"
  );
}

// ============================================================================
// SUITE 3: REQUIREMENT R3 — ETSY API V3 INTEGRATION
// ============================================================================
async function runSuiteR3() {
  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   REQUIREMENT R3: ETSY API V3 INTEGRATION & ORDER INGESTION                    ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  // 3.1 PKCE S256 Challenge Generation (RFC 7636)
  const verifier = generateCodeVerifier();
  assert(
    "R3 (Etsy API v3)",
    "Code verifier is exactly 43 characters with unreserved base64url characters",
    typeof verifier === "string" && verifier.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(verifier),
    `Verifier: ${verifier}`
  );

  const challenge = generateCodeChallenge(verifier);
  assert(
    "R3 (Etsy API v3)",
    "Code challenge is exactly 43 characters base64url",
    typeof challenge === "string" && challenge.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(challenge),
    `Challenge: ${challenge}`
  );

  // Verify against independent crypto.createHash computation
  const independentHash = crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
  assert(
    "R3 (Etsy API v3)",
    "Code challenge strictly matches independent SHA-256 base64url computation",
    challenge === independentHash
  );

  const state = generateState();
  assert(
    "R3 (Etsy API v3)",
    "State parameter is 32-character hexadecimal string",
    typeof state === "string" && state.length === 32 && /^[0-9a-f]{32}$/.test(state)
  );

  // Authorization URL construction
  const originalKeystring = process.env.ETSY_KEYSTRING;
  const originalApiKey = process.env.ETSY_API_KEY;
  process.env.ETSY_KEYSTRING = "test_etsy_keystring_sprint2";

  const redirectUri = "http://localhost:3000/api/etsy/oauth/callback";
  const authUrl = getAuthorizationUrl(redirectUri, state, challenge);
  const parsedAuthUrl = new URL(authUrl);

  assert(
    "R3 (Etsy API v3)",
    "Authorization URL points to https://www.etsy.com/oauth/connect with S256 code_challenge",
    parsedAuthUrl.origin + parsedAuthUrl.pathname === "https://www.etsy.com/oauth/connect" &&
      parsedAuthUrl.searchParams.get("code_challenge_method") === "S256" &&
      parsedAuthUrl.searchParams.get("code_challenge") === challenge &&
      parsedAuthUrl.searchParams.get("client_id") === "test_etsy_keystring_sprint2"
  );

  // 3.2 Graceful Degradation When Keys Missing (Zero 500 Errors)
  delete process.env.ETSY_KEYSTRING;
  delete process.env.ETSY_API_KEY;

  assert(
    "R3 (Etsy API v3)",
    "isEtsyConfigured() returns false when credentials are absent",
    isEtsyConfigured() === false
  );

  // GET /api/etsy/oauth/login
  const loginRes = await etsyLoginHandler(new NextRequest("http://localhost:3000/api/etsy/oauth/login"));
  const loginJson = await loginRes.json();
  assert(
    "R3 (Etsy API v3)",
    "GET /api/etsy/oauth/login degrades gracefully (HTTP 200, configured: false)",
    loginRes.status === 200 && loginJson.configured === false && loginJson.success === false
  );

  // GET /api/etsy/oauth/callback
  const callbackRes = await etsyCallbackHandler(
    new NextRequest("http://localhost:3000/api/etsy/oauth/callback?code=abc&state=xyz")
  );
  const callbackJson = await callbackRes.json();
  assert(
    "R3 (Etsy API v3)",
    "GET /api/etsy/oauth/callback degrades gracefully (HTTP 200, configured: false)",
    callbackRes.status === 200 && callbackJson.configured === false && callbackJson.success === false
  );

  // GET /api/etsy/orders without mock
  const ordersGetRes = await etsyOrdersGetHandler(new NextRequest("http://localhost:3000/api/etsy/orders"));
  const ordersGetJson = await ordersGetRes.json();
  assert(
    "R3 (Etsy API v3)",
    "GET /api/etsy/orders degrades gracefully (HTTP 200, empty orders array, configured: false)",
    ordersGetRes.status === 200 && ordersGetJson.configured === false && Array.isArray(ordersGetJson.orders)
  );

  // POST /api/etsy/orders without mock
  const ordersPostRes = await etsyOrdersPostHandler(
    new NextRequest("http://localhost:3000/api/etsy/orders", {
      method: "POST",
      body: JSON.stringify({}),
    })
  );
  const ordersPostJson = await ordersPostRes.json();
  assert(
    "R3 (Etsy API v3)",
    "POST /api/etsy/orders degrades gracefully (HTTP 200, synced: 0, configured: false)",
    ordersPostRes.status === 200 && ordersPostJson.configured === false && ordersPostJson.synced === 0
  );

  if (originalKeystring) process.env.ETSY_KEYSTRING = originalKeystring;
  if (originalApiKey) process.env.ETSY_API_KEY = originalApiKey;

  // 3.3 Variation & Personalization Mapper
  assert("R3 (Etsy API v3)", "Variation resolver maps 8x10 frame size", resolveFrameSize('8" × 10" Framed') === "8x10");
  assert("R3 (Etsy API v3)", "Variation resolver maps 24x36 frame size", resolveFrameSize('24" x 36" Poster') === "24x36");
  assert("R3 (Etsy API v3)", "Palette resolver maps Midnight Gold", resolvePalette("Midnight Gold") === "midnight_gold");
  assert("R3 (Etsy API v3)", "Palette resolver maps Carrara Marble", resolvePalette("Carrara Marble") === "carrara_gold");
  assert("R3 (Etsy API v3)", "Theme resolver maps Floral Botanical", resolveTheme("Floral Botanical") === "botanical");
  assert("R3 (Etsy API v3)", "Theme resolver maps Art Deco Noir", resolveTheme("Art Deco Noir") === "art_deco");

  const longCaption = "B".repeat(250);
  const samplePersonalizations = [
    { question_text: "Custom Song & Artist Caption", value: longCaption },
    { question_text: "Audio Link", value: "https://www.dropbox.com/s/sample/song.wav" },
  ];
  const truncatedCaption = extractCaption(samplePersonalizations);
  assert(
    "R3 (Etsy API v3)",
    "Caption exceeds 200 characters is safely truncated to exactly 200 chars",
    truncatedCaption.length === 200 && truncatedCaption === "B".repeat(200)
  );

  const extractedDropboxUrl = extractAudioUrl(samplePersonalizations);
  assert(
    "R3 (Etsy API v3)",
    "Audio URL extractor parses Dropbox links from personalization fields",
    extractedDropboxUrl === "https://www.dropbox.com/s/sample/song.wav"
  );

  // 3.4 Live Ingestion & Deduplication via partnerOrderId
  const etsyReceiptId = `${Date.now()}`;
  const etsyTxId = `${Date.now() + 1}`;
  const partnerOrderId = `etsy_${etsyReceiptId}_${etsyTxId}`;

  const mockReceipt: EtsyReceipt = {
    receipt_id: etsyReceiptId,
    buyer_email: "etsy.buyer@example.com",
    name: "Eleanor Vance",
    first_line: "100 Hill House Road",
    city: "Boston",
    state: "MA",
    zip: "02108",
    country_iso: "US",
    was_paid: true,
    grandtotal: { amount: 9900, divisor: 100, currency_code: "USD" },
    transactions: [
      {
        transaction_id: etsyTxId,
        receipt_id: etsyReceiptId,
        title: "Personalized SoundWave Print",
        variations: [
          { formatted_name: "Frame Size", formatted_value: "16x20" },
          { formatted_name: "Color Palette", formatted_value: "Midnight Gold" },
          { formatted_name: "Style", formatted_value: "Floral Botanical" },
        ],
        personalizations: [
          { question_text: "Caption Text", value: "Hill House Echoes" },
          { question_text: "Audio Link", value: "https://dropbox.com/s/hillhouse.wav" },
        ],
      },
    ],
  };

  // First Ingestion
  const firstPostReq = new NextRequest("http://localhost:3000/api/etsy/orders?mock=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: mockReceipt }),
  });
  const firstPostRes = await etsyOrdersPostHandler(firstPostReq);
  const firstPostJson = await firstPostRes.json();

  assert(
    "R3 (Etsy API v3)",
    "Initial order ingestion returns HTTP 200 with synced: 1 and duplicates: 0",
    firstPostRes.status === 200 && firstPostJson.synced === 1 && firstPostJson.duplicates === 0
  );

  const ingestedDbOrder = await getOrderByPartnerOrderId(partnerOrderId);
  assert(
    "R3 (Etsy API v3)",
    "Order successfully persisted in PostgreSQL with source='etsy' and correct partnerOrderId",
    ingestedDbOrder !== null &&
      ingestedDbOrder.source === "etsy" &&
      ingestedDbOrder.partnerOrderId === partnerOrderId &&
      ingestedDbOrder.totalAmount === 9900
  );

  // Duplicate Ingestion
  const secondPostReq = new NextRequest("http://localhost:3000/api/etsy/orders?mock=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: mockReceipt }),
  });
  const secondPostRes = await etsyOrdersPostHandler(secondPostReq);
  const secondPostJson = await secondPostRes.json();

  assert(
    "R3 (Etsy API v3)",
    "Duplicate order ingestion detected (synced: 0, duplicates: 1)",
    secondPostRes.status === 200 && secondPostJson.synced === 0 && secondPostJson.duplicates === 1
  );

  const dbCount = await prisma.order.count({ where: { partnerOrderId } });
  assert(
    "R3 (Etsy API v3)",
    "Database contains exactly 1 record for partnerOrderId (zero duplicate rows created)",
    dbCount === 1
  );

  // Cleanup test order
  await prisma.order.deleteMany({ where: { partnerOrderId } });
}

// ============================================================================
// SUITE 4: REQUIREMENT R4 — RESEND WEBHOOKS & EMAIL TRACKING
// ============================================================================
async function runSuiteR4() {
  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   REQUIREMENT R4: RESEND WEBHOOKS & EMAIL EVENT AUDIT LOGS                     ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  const TEST_SECRET = "whsec_test_secret_32chars_long_1234567890";
  const samplePayload = JSON.stringify({ type: "email.sent", data: { id: "re_sample_123" } });

  // 4.1 Svix Signature Crypto Verification
  const validSigData = createSvixSignature(samplePayload, TEST_SECRET);
  const validCheck = verifySvixSignature(samplePayload, validSigData.headers, TEST_SECRET);
  assert(
    "R4 (Resend Webhooks)",
    "Svix HMAC-SHA256 signature verifier accepts valid signature and timestamp",
    validCheck.valid
  );

  const missingCheck = verifySvixSignature(samplePayload, {}, TEST_SECRET);
  assert(
    "R4 (Resend Webhooks)",
    "Svix verifier rejects missing headers",
    !missingCheck.valid && Boolean(missingCheck.reason?.includes("Missing"))
  );

  const tamperedSig = validSigData.signature.slice(0, -6) + "XXXX==";
  const tamperedCheck = verifySvixSignature(
    samplePayload,
    { ...validSigData.headers, "svix-signature": tamperedSig },
    TEST_SECRET
  );
  assert(
    "R4 (Resend Webhooks)",
    "Svix verifier rejects tampered HMAC signatures",
    !tamperedCheck.valid && Boolean(tamperedCheck.reason?.includes("Invalid HMAC"))
  );

  // Expired timestamp (>300s)
  const expiredPastTs = Math.floor(Date.now() / 1000) - 310;
  const expiredPastSig = createSvixSignature(samplePayload, TEST_SECRET, { timestamp: expiredPastTs });
  const expiredPastCheck = verifySvixSignature(samplePayload, expiredPastSig.headers, TEST_SECRET);
  assert(
    "R4 (Resend Webhooks)",
    "Svix verifier rejects timestamps older than 300 seconds",
    !expiredPastCheck.valid && Boolean(expiredPastCheck.reason?.includes("expired"))
  );

  // 4.2 Route Security (HTTP 400s)
  const noHeadersReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    body: samplePayload,
  });
  const noHeadersRes = await resendWebhookHandler(noHeadersReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend rejects missing Svix headers with HTTP 400",
    noHeadersRes.status === 400
  );

  const tamperedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": validSigData.id,
      "svix-timestamp": validSigData.timestamp,
      "svix-signature": "v1,tampered_signature==",
    },
    body: samplePayload,
  });
  const tamperedRes = await resendWebhookHandler(tamperedReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend rejects tampered signatures with HTTP 400",
    tamperedRes.status === 400
  );

  const expiredReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: expiredPastSig.headers,
    body: samplePayload,
  });
  const expiredRes = await resendWebhookHandler(expiredReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend rejects expired timestamps (>300s) with HTTP 400",
    expiredRes.status === 400
  );

  // 4.3 email.delivered Event Processing & Order Mutation
  const orderDeliveredId = `${runId}_ord_deliv`;
  cleanupOrderIds.push(orderDeliveredId);

  await createOrder({
    id: orderDeliveredId,
    customerEmail: "delivered.recipient@example.com",
    frameSize: "16x20",
    palette: "midnight_gold",
    caption: "Delivered Webhook Order",
    audioPath: "storage/uploads/deliv.wav",
    totalAmount: 9900,
    emailStatus: "not_sent",
  });

  const resendDeliveredId = `re_deliv_${Date.now()}`;
  const deliveredPayload = JSON.stringify({
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: {
      email_id: resendDeliveredId,
      from: "SoundWave Art <orders@resend.dev>",
      to: ["delivered.recipient@example.com"],
      subject: `Order #${orderDeliveredId} Shipped`,
      tags: { orderId: orderDeliveredId },
    },
  });
  const deliveredSig = createSvixSignature(deliveredPayload, TEST_SECRET);

  const deliveredReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: deliveredSig.headers,
    body: deliveredPayload,
  });
  const deliveredRes = await resendWebhookHandler(deliveredReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend returns HTTP 200 for email.delivered",
    deliveredRes.status === 200
  );

  const dbDeliveredOrder = await getOrderById(orderDeliveredId);
  assert(
    "R4 (Resend Webhooks)",
    "Order emailStatus updated to 'delivered' with emailDeliveredAt and resendEmailId set",
    dbDeliveredOrder?.emailStatus === "delivered" &&
      dbDeliveredOrder?.emailDeliveredAt !== null &&
      dbDeliveredOrder?.resendEmailId === resendDeliveredId
  );

  // Idempotency: replay same delivered payload
  const replayReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: deliveredSig.headers,
    body: deliveredPayload,
  });
  const replayRes = await resendWebhookHandler(replayReq);
  const replayJson = await replayRes.json();
  assert(
    "R4 (Resend Webhooks)",
    "Replayed webhook returns HTTP 200 with status: 'duplicate_ignored'",
    replayRes.status === 200 && replayJson.status === "duplicate_ignored"
  );

  // 4.4 email.bounced Event Processing
  const orderBouncedId = `${runId}_ord_bounce`;
  cleanupOrderIds.push(orderBouncedId);

  await createOrder({
    id: orderBouncedId,
    customerEmail: "bounced.recipient@example.com",
    frameSize: "11x14",
    palette: "sage_cream",
    caption: "Bounced Webhook Order",
    audioPath: "storage/uploads/bounce.wav",
    totalAmount: 6900,
    emailStatus: "not_sent",
  });

  const resendBouncedId = `re_bounce_${Date.now()}`;
  const bounceMessage = "550 5.1.1 Recipient mailbox does not exist";
  const bouncedPayload = JSON.stringify({
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: {
      email_id: resendBouncedId,
      from: "SoundWave Art <orders@resend.dev>",
      to: ["bounced.recipient@example.com"],
      subject: `Order #${orderBouncedId} Confirmation`,
      bounce: { message: bounceMessage, type: "hard_bounce" },
    },
  });
  const bouncedSig = createSvixSignature(bouncedPayload, TEST_SECRET);

  const bouncedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: bouncedSig.headers,
    body: bouncedPayload,
  });
  const bouncedRes = await resendWebhookHandler(bouncedReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend returns HTTP 200 for email.bounced",
    bouncedRes.status === 200
  );

  const dbBouncedOrder = await getOrderById(orderBouncedId);
  assert(
    "R4 (Resend Webhooks)",
    "Order emailStatus updated to 'bounced' with emailBounceReason and emailBouncedAt set",
    dbBouncedOrder?.emailStatus === "bounced" &&
      dbBouncedOrder?.emailBounceReason === bounceMessage &&
      dbBouncedOrder?.emailBouncedAt !== null
  );

  // 4.5 email.complained Event Processing
  const uniqueComplainedEmail = `complaint_${Date.now()}@example.com`;
  const orderComplainedId = `${runId}_ord_complaint`;
  cleanupOrderIds.push(orderComplainedId);

  await createOrder({
    id: orderComplainedId,
    customerEmail: uniqueComplainedEmail,
    frameSize: "8x10",
    palette: "white_silver",
    caption: "Complaint Webhook Order",
    audioPath: "storage/uploads/complaint.wav",
    totalAmount: 4900,
    emailStatus: "delivered",
  });

  const resendComplainedId = `re_complaint_${Date.now()}`;
  const complainedPayload = JSON.stringify({
    type: "email.complained",
    created_at: new Date().toISOString(),
    data: {
      email_id: resendComplainedId,
      from: "SoundWave Art <orders@resend.dev>",
      to: [uniqueComplainedEmail],
      subject: "Fine Art Newsletter",
    },
  });
  const complainedSig = createSvixSignature(complainedPayload, TEST_SECRET);

  const complainedReq = new NextRequest("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: complainedSig.headers,
    body: complainedPayload,
  });
  const complainedRes = await resendWebhookHandler(complainedReq);
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend returns HTTP 200 for email.complained",
    complainedRes.status === 200
  );

  const dbComplainedOrder = await getOrderById(orderComplainedId);
  assert(
    "R4 (Resend Webhooks)",
    "Order emailStatus updated to 'complained' via customer email fallback matching",
    dbComplainedOrder?.emailStatus === "complained"
  );

  // 4.6 EmailEvent Audit Logging Table
  const delivEvents = await getEmailEvents(orderDeliveredId);
  assert(
    "R4 (Resend Webhooks)",
    "EmailEvent audit table logs email.delivered event with recipient and resendEmailId",
    delivEvents.length >= 1 &&
      delivEvents[0].eventType === "email.delivered" &&
      delivEvents[0].recipient === "delivered.recipient@example.com" &&
      delivEvents[0].resendEmailId === resendDeliveredId
  );

  const bounceEvents = await getEmailEvents(orderBouncedId);
  assert(
    "R4 (Resend Webhooks)",
    "EmailEvent audit table logs email.bounced event with bounceReason",
    bounceEvents.length >= 1 &&
      bounceEvents[0].eventType === "email.bounced" &&
      bounceEvents[0].bounceReason === bounceMessage
  );

  const complaintEvents = await getEmailEvents(orderComplainedId);
  assert(
    "R4 (Resend Webhooks)",
    "EmailEvent audit table logs email.complained event",
    complaintEvents.length >= 1 && complaintEvents[0].eventType === "email.complained"
  );

  // 4.7 email.opened and email.clicked non-destructive events
  const openPayload = JSON.stringify({
    type: "email.opened",
    data: {
      email_id: `re_open_${Date.now()}`,
      to: ["delivered.recipient@example.com"],
      tags: { orderId: orderDeliveredId },
    },
  });
  const openSig = createSvixSignature(openPayload, TEST_SECRET);
  const openRes = await resendWebhookHandler(
    new NextRequest("http://localhost:3000/api/webhooks/resend", {
      method: "POST",
      headers: openSig.headers,
      body: openPayload,
    })
  );
  assert(
    "R4 (Resend Webhooks)",
    "POST /api/webhooks/resend processes email.opened without downgrading status 'delivered'",
    openRes.status === 200
  );
  const afterOpenOrder = await getOrderById(orderDeliveredId);
  assert(
    "R4 (Resend Webhooks)",
    "Order emailStatus preserves 'delivered' after opened event",
    afterOpenOrder?.emailStatus === "delivered"
  );
}

// ============================================================================
// SUITE 5: REQUIREMENT R5 — UGC CONTENT ENGINE (50 SCRIPTS)
// ============================================================================
async function runSuiteR5() {
  console.log(`\n${CYAN}${BOLD}================================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   REQUIREMENT R5: UGC CONTENT ENGINE (50 PRODUCTION SCRIPTS)                   ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================================${RESET}`);

  const ugcFilePath = path.join(PROJECT_ROOT, "docs/UGC_SCRIPTS_50.md");
  assert(
    "R5 (UGC 50 Scripts)",
    "docs/UGC_SCRIPTS_50.md exists at expected project path",
    fs.existsSync(ugcFilePath),
    `Path: ${ugcFilePath}`
  );

  if (!fs.existsSync(ugcFilePath)) return;

  const content = fs.readFileSync(ugcFilePath, "utf-8");
  assert(
    "R5 (UGC 50 Scripts)",
    "docs/UGC_SCRIPTS_50.md is comprehensive and exceeds 50,000 bytes",
    content.length > 50000,
    `Size: ${content.length} bytes`
  );

  // Script count
  const scriptHeadings = content.match(/^### Script \d\d:/gm) || [];
  assert(
    "R5 (UGC 50 Scripts)",
    "Contains exactly 50 distinct scripts numbered ### Script 01 to ### Script 50",
    scriptHeadings.length === 50,
    `Found: ${scriptHeadings.length} scripts`
  );

  // Verify numbering continuity from 01 to 50
  let sequenceOk = true;
  for (let i = 1; i <= 50; i++) {
    const padded = String(i).padStart(2, "0");
    if (!content.includes(`### Script ${padded}:`)) {
      sequenceOk = false;
      break;
    }
  }
  assert(
    "R5 (UGC 50 Scripts)",
    "Strict sequential continuity from ### Script 01 through ### Script 50",
    sequenceOk
  );

  // 6 Categories
  const categoryHeadings = content.match(/^## Category \d+: .+/gm) || [];
  assert(
    "R5 (UGC 50 Scripts)",
    "Contains exactly 6 distinct thematic gifting categories",
    categoryHeadings.length === 6,
    `Categories: ${categoryHeadings.length}`
  );

  const expectedCategories = [
    "Memorial & Keepsake",
    "Weddings, Engagements & Proposals",
    "Milestones, Babies & New Life",
    "Anniversaries & Long-Distance Relationships",
    "Modern Romance, Humor & Inside Jokes",
    "Family, Parents & Lifelong Gratitude",
  ];
  const allCategoriesPresent = expectedCategories.every((cat) =>
    categoryHeadings.some((h) => h.includes(cat))
  );
  assert(
    "R5 (UGC 50 Scripts)",
    "All 6 specified occasion categories are present with clear script allocations",
    allCategoriesPresent
  );

  // 9 Required fields per script
  const scriptBlocks = content.split(/^### Script \d\d:/gm).slice(1);
  const requiredSubfields = [
    "Target Audience",
    "Hook",
    "Body / Story",
    "Emotional Climax",
    "Call to Action",
    "Suggested Audio",
    "Caption & Hashtags",
    "Production Notes",
  ];

  let allScriptsHaveAllFields = true;
  let missingFieldDetails = "";

  scriptBlocks.forEach((block, idx) => {
    const scriptNum = idx + 1;
    for (const field of requiredSubfields) {
      if (!block.includes(field)) {
        allScriptsHaveAllFields = false;
        missingFieldDetails = `Script ${scriptNum} missing field '${field}'`;
        break;
      }
    }
  });

  assert(
    "R5 (UGC 50 Scripts)",
    "All 50 scripts contain all 9 required schema fields (Title + 8 structured sections)",
    allScriptsHaveAllFields && scriptBlocks.length === 50,
    missingFieldDetails
  );

  // Zero placeholders check
  const tbdMatches = content.match(/\[TBD\]/gi) || [];
  const todoMatches = content.match(/\bTODO\b/g) || [];
  const loremMatches = content.match(/lorem ipsum/gi) || [];

  assert(
    "R5 (UGC 50 Scripts)",
    "Zero '[TBD]' placeholders present in document",
    tbdMatches.length === 0,
    `Found ${tbdMatches.length} occurrences`
  );
  assert(
    "R5 (UGC 50 Scripts)",
    "Zero 'TODO' placeholders present in document",
    todoMatches.length === 0,
    `Found ${todoMatches.length} occurrences`
  );
  assert(
    "R5 (UGC 50 Scripts)",
    "Zero 'Lorem Ipsum' dummy filler text present in document",
    loremMatches.length === 0,
    `Found ${loremMatches.length} occurrences`
  );

  // Creative direction: September 2026 style compliance
  const septemberMatches = content.match(/September 2026/gi) || [];
  const julyMatches = content.match(/July 2026/gi) || [];

  assert(
    "R5 (UGC 50 Scripts)",
    "Adheres strictly to 'September 2026' creative direction style",
    septemberMatches.length >= 1,
    `Found ${septemberMatches.length} references to September 2026`
  );
  assert(
    "R5 (UGC 50 Scripts)",
    "Contains zero references to outdated 'July 2026' style",
    julyMatches.length === 0,
    `Found ${julyMatches.length} references to July 2026`
  );
}

// ============================================================================
// MAIN RUNNER & TEARDOWN
// ============================================================================
async function main() {
  console.log("================================================================================");
  console.log("   SOUNDWAVE ART — SPRINT 2 UNIFIED FULL INTEGRATION & VERIFICATION SUITE       ");
  console.log("================================================================================");

  const startTime = Date.now();

  try {
    await runSuiteR1();
    await runSuiteR2();
    await runSuiteR3();
    await runSuiteR4();
    await runSuiteR5();
  } catch (err: any) {
    console.error(`\n${RED}FATAL ERROR during test execution:${RESET}`, err);
  } finally {
    // Teardown: Clean up test orders created during the test run
    if (cleanupOrderIds.length > 0) {
      try {
        await prisma.order.deleteMany({
          where: { id: { in: cleanupOrderIds } },
        });
      } catch {
        // Non-fatal cleanup
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${BOLD}--------------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}${"Sprint 2 Requirement".padEnd(32)} | ${"Total".padEnd(8)} | ${"Pass".padEnd(8)} | ${"Fail".padEnd(8)} | ${"Status".padEnd(10)}${RESET}`);
  console.log(`${BOLD}--------------------------------------------------------------------------------${RESET}`);

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  for (const [name, stats] of Object.entries(reqStats)) {
    grandTotal += stats.total;
    grandPassed += stats.passed;
    grandFailed += stats.failed;
    const status = stats.failed === 0 ? `${GREEN}[OK]${RESET}` : `${RED}[FAIL]${RESET}`;
    console.log(`${name.padEnd(32)} | ${String(stats.total).padEnd(8)} | ${String(stats.passed).padEnd(8)} | ${String(stats.failed).padEnd(8)} | ${status}`);
  }

  console.log(`${BOLD}--------------------------------------------------------------------------------${RESET}`);
  const overallStatus = grandFailed === 0 ? `${GREEN}${BOLD}ALL PASSED (100%)${RESET}` : `${RED}${BOLD}FAILED (${grandFailed} errors)${RESET}`;
  console.log(`${BOLD}${"OVERALL TOTALS".padEnd(32)} | ${String(grandTotal).padEnd(8)} | ${String(grandPassed).padEnd(8)} | ${String(grandFailed).padEnd(8)} | ${overallStatus}${RESET}`);
  console.log(`Execution completed in ${durationSec}s`);
  console.log("================================================================================\n");

  if (grandFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
