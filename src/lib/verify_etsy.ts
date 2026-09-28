/**
 * Etsy API v3 Integration Verification Test Suite
 *
 * Verifies:
 * 1. PKCE challenge generation format (base64url, S256, RFC 7636 compliance).
 * 2. Graceful degradation when unconfigured (HTTP 200 with structured JSON, zero unhandled errors).
 * 3. Accurate mapping of Etsy variations, personalizations, captions, and shipping data.
 * 4. Live database insertion and deduplication check via partnerOrderId.
 */

import crypto from "crypto";
import { NextRequest } from "next/server";
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
  mapEtsyTransactionToOrder,
  EtsyReceipt,
  EtsyTransaction,
} from "./etsy";
import { GET as loginHandler } from "@/app/api/etsy/oauth/login/route";
import { GET as callbackHandler } from "@/app/api/etsy/oauth/callback/route";
import { GET as ordersGetHandler, POST as ordersPostHandler } from "@/app/api/etsy/orders/route";
import { prisma, getOrderByPartnerOrderId } from "./db";

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

async function runEtsyVerificationSuite() {
  console.log("==================================================");
  console.log("   SOUNDWAVE ART — ETSY API V3 VERIFICATION SUITE");
  console.log("==================================================");

  // ------------------------------------------------------------------------
  // SUITE 1: PKCE Challenge Generation & Format (RFC 7636)
  // ------------------------------------------------------------------------
  console.log("\n--- 1. PKCE Challenge Generation & Format (RFC 7636) ---");

  const verifier1 = generateCodeVerifier();
  const verifier2 = generateCodeVerifier();

  assert(
    typeof verifier1 === "string" && verifier1.length === 43,
    "Code verifier length is exactly 43 characters (32 bytes base64url)",
    `Length: ${verifier1?.length}`
  );

  assert(
    /^[A-Za-z0-9_-]{43}$/.test(verifier1),
    "Code verifier contains only unreserved base64url characters [A-Za-z0-9_-]"
  );

  assert(
    verifier1 !== verifier2,
    "Sequential code verifiers are cryptographically unique (high entropy)"
  );

  const challenge1 = generateCodeChallenge(verifier1);
  assert(
    typeof challenge1 === "string" && challenge1.length === 43,
    "Code challenge length is exactly 43 characters (SHA256 base64url)",
    `Length: ${challenge1?.length}`
  );

  assert(
    /^[A-Za-z0-9_-]{43}$/.test(challenge1),
    "Code challenge contains only unreserved base64url characters [A-Za-z0-9_-]"
  );

  // Verify challenge against independent reference implementation
  const independentHash = crypto
    .createHash("sha256")
    .update(verifier1, "utf8")
    .digest("base64url");
  assert(
    challenge1 === independentHash,
    "Code challenge matches independent S256 base64url computation"
  );

  // State parameter check
  const state = generateState();
  assert(
    typeof state === "string" && state.length === 32 && /^[0-9a-f]{32}$/.test(state),
    "State parameter is 32-character hexadecimal string"
  );

  // Authorization URL construction
  const originalKeystring = process.env.ETSY_KEYSTRING;
  const originalApiKey = process.env.ETSY_API_KEY;
  process.env.ETSY_KEYSTRING = "test_etsy_keystring_12345";

  const redirectUri = "http://localhost:3000/api/etsy/oauth/callback";
  const authUrl = getAuthorizationUrl(redirectUri, state, challenge1);
  const parsedUrl = new URL(authUrl);

  assert(
    parsedUrl.origin + parsedUrl.pathname === "https://www.etsy.com/oauth/connect",
    "Authorization URL points to https://www.etsy.com/oauth/connect"
  );
  assert(
    parsedUrl.searchParams.get("response_type") === "code",
    "Authorization URL includes response_type=code"
  );
  assert(
    parsedUrl.searchParams.get("client_id") === "test_etsy_keystring_12345",
    "Authorization URL includes configured client_id"
  );
  assert(
    parsedUrl.searchParams.get("code_challenge_method") === "S256",
    "Authorization URL enforces S256 code challenge method"
  );
  assert(
    parsedUrl.searchParams.get("code_challenge") === challenge1,
    "Authorization URL includes computed code challenge"
  );
  assert(
    parsedUrl.searchParams.get("state") === state,
    "Authorization URL includes CSRF state parameter"
  );
  assert(
    parsedUrl.searchParams.get("scope") === "transactions_r shops_r",
    "Authorization URL includes required scopes 'transactions_r shops_r'"
  );

  // ------------------------------------------------------------------------
  // SUITE 2: Graceful Degradation When Unconfigured
  // ------------------------------------------------------------------------
  console.log("\n--- 2. Graceful Degradation When Unconfigured ---");

  // Unset keys
  delete process.env.ETSY_KEYSTRING;
  delete process.env.ETSY_API_KEY;

  assert(
    isEtsyConfigured() === false,
    "isEtsyConfigured() returns false when credentials are absent"
  );

  let caughtError: any = null;
  try {
    getAuthorizationUrl(redirectUri, state, challenge1);
  } catch (err) {
    caughtError = err;
  }
  assert(
    caughtError !== null && /not configured/i.test(caughtError?.message || ""),
    "getAuthorizationUrl throws descriptive error when unconfigured"
  );

  // Test GET /api/etsy/oauth/login unconfigured
  const loginReq = new NextRequest("http://localhost:3000/api/etsy/oauth/login");
  const loginRes = await loginHandler(loginReq);
  const loginJson = await loginRes.json();

  assert(
    loginRes.status === 200,
    "GET /api/etsy/oauth/login returns HTTP 200 when unconfigured"
  );
  assert(
    loginJson.configured === false && loginJson.success === false,
    "GET /api/etsy/oauth/login returns { success: false, configured: false }"
  );
  assert(
    typeof loginJson.warning === "string" && loginJson.warning.length > 0,
    "GET /api/etsy/oauth/login returns explanatory warning string"
  );

  // Test GET /api/etsy/oauth/callback unconfigured
  const callbackReq = new NextRequest("http://localhost:3000/api/etsy/oauth/callback?code=abc&state=xyz");
  const callbackRes = await callbackHandler(callbackReq);
  const callbackJson = await callbackRes.json();

  assert(
    callbackRes.status === 200,
    "GET /api/etsy/oauth/callback returns HTTP 200 when unconfigured"
  );
  assert(
    callbackJson.configured === false && callbackJson.success === false,
    "GET /api/etsy/oauth/callback returns { success: false, configured: false }"
  );

  // Test GET /api/etsy/orders unconfigured without mock
  const ordersGetReq = new NextRequest("http://localhost:3000/api/etsy/orders");
  const ordersGetRes = await ordersGetHandler(ordersGetReq);
  const ordersGetJson = await ordersGetRes.json();

  assert(
    ordersGetRes.status === 200,
    "GET /api/etsy/orders returns HTTP 200 when unconfigured"
  );
  assert(
    ordersGetJson.configured === false && Array.isArray(ordersGetJson.orders) && ordersGetJson.orders.length === 0,
    "GET /api/etsy/orders returns empty orders array and configured: false"
  );

  // Test POST /api/etsy/orders unconfigured without mock
  const ordersPostReq = new NextRequest("http://localhost:3000/api/etsy/orders", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const ordersPostRes = await ordersPostHandler(ordersPostReq);
  const ordersPostJson = await ordersPostRes.json();

  assert(
    ordersPostRes.status === 200,
    "POST /api/etsy/orders returns HTTP 200 when unconfigured"
  );
  assert(
    ordersPostJson.configured === false && ordersPostJson.synced === 0,
    "POST /api/etsy/orders returns synced: 0 and configured: false"
  );

  // Restore env if it was set
  if (originalKeystring) process.env.ETSY_KEYSTRING = originalKeystring;
  if (originalApiKey) process.env.ETSY_API_KEY = originalApiKey;

  // ------------------------------------------------------------------------
  // SUITE 3: Accurate Mapping of Variations, Personalizations & Shipping Data
  // ------------------------------------------------------------------------
  console.log("\n--- 3. Accurate Mapping of Etsy Data Structures ---");

  // Frame size variation resolution
  assert(resolveFrameSize('8" × 10" Framed') === "8x10", "Resolves 8x10 variation");
  assert(resolveFrameSize("11x14 inches") === "11x14", "Resolves 11x14 variation");
  assert(resolveFrameSize("16 x 20 Canvas") === "16x20", "Resolves 16x20 variation");
  assert(resolveFrameSize("24x36 Poster") === "24x36", "Resolves 24x36 variation");
  assert(resolveFrameSize("Extra Large Unknown Size") === "16x20", "Defaults unknown size to 16x20");
  assert(resolveFrameSize(null) === "16x20", "Defaults null size to 16x20");

  // Palette resolution
  assert(resolvePalette("Midnight Gold") === "midnight_gold", "Resolves Midnight Gold palette");
  assert(resolvePalette("Everest Silver") === "white_silver", "Resolves Everest Silver palette");
  assert(resolvePalette("Ocean Navy") === "dark_blue_white", "Resolves Ocean Navy palette");
  assert(resolvePalette("Nordic Slate") === "nordic_slate", "Resolves Nordic Slate palette");
  assert(resolvePalette("Blush Rose Gold") === "blush_rosegold", "Resolves Blush Rose Gold palette");
  assert(resolvePalette("Sage Eucalyptus") === "sage_cream", "Resolves Sage Eucalyptus palette");
  assert(resolvePalette("Warm Sand") === "warm_sand", "Resolves Warm Sand palette");
  assert(resolvePalette("Bauhaus Cobalt") === "bauhaus_primary", "Resolves Bauhaus Cobalt palette");
  assert(resolvePalette("Vintage Tobacco") === "vintage_tobacco", "Resolves Vintage Tobacco palette");
  assert(resolvePalette("Cosmic Obsidian") === "celestial_night", "Resolves Cosmic Obsidian palette");
  assert(resolvePalette("Carrara Marble") === "carrara_gold", "Resolves Carrara Marble palette");
  assert(resolvePalette("Random Color 999") === "midnight_gold", "Defaults unknown palette to midnight_gold");

  // Decorative style / theme resolution
  assert(resolveTheme("Floral Botanical") === "botanical", "Resolves Floral Botanical theme");
  assert(resolveTheme("Modern Double Border") === "modern_border", "Resolves Modern Double Border theme");
  assert(resolveTheme("Architectural Arch") === "arch", "Resolves Architectural Arch theme");
  assert(resolveTheme("Art Deco Noir") === "art_deco", "Resolves Art Deco Noir theme");
  assert(resolveTheme("Vintage Grunge") === "vintage_grunge", "Resolves Vintage Grunge theme");
  assert(resolveTheme("Luxury Marble Arch") === "luxury_marble", "Resolves Luxury Marble Arch theme");
  assert(resolveTheme("Abstract Geometric") === "abstract_geometric", "Resolves Abstract Geometric theme");
  assert(resolveTheme("Celestial Starlight") === "celestial", "Resolves Celestial Starlight theme");
  assert(resolveTheme("Clean Minimal") === "minimal", "Resolves Clean Minimal theme");
  assert(resolveTheme("Unknown Abstract Style") === "botanical", "Defaults unknown theme to botanical");

  // Caption extraction & 200 char truncation
  const longCaption = "A".repeat(250);
  const samplePersonalizations = [
    { question_text: "Custom Song & Artist Caption", value: longCaption },
    { question_text: "Audio Link", value: "https://www.dropbox.com/s/123/song.wav" },
  ];
  const extractedCaption = extractCaption(samplePersonalizations);
  assert(
    extractedCaption.length === 200,
    "Caption exceeds 200 characters is safely truncated to exactly 200 chars",
    `Length: ${extractedCaption.length}`
  );
  assert(
    extractedCaption === "A".repeat(200),
    "Truncated caption contains initial 200 characters intact"
  );

  // Audio URL extraction
  const dropboxUrl = extractAudioUrl(samplePersonalizations);
  assert(
    dropboxUrl === "https://www.dropbox.com/s/123/song.wav",
    "Extracts Dropbox audio URL from personalizations"
  );

  const googleDrivePersonalizations = [
    {
      question_text: "Audio File Link",
      value: "Here is my audio file: https://drive.google.com/file/d/1A2B3C/view?usp=sharing please use this",
    },
  ];
  const gdriveUrl = extractAudioUrl(googleDrivePersonalizations);
  assert(
    gdriveUrl === "https://drive.google.com/file/d/1A2B3C/view?usp=sharing",
    "Extracts Google Drive URL surrounded by conversational text"
  );

  const missingAudioPersonalizations = [
    { question_text: "Custom Caption", value: "Happy Birthday Mom" },
  ];
  const noAudioUrl = extractAudioUrl(missingAudioPersonalizations);
  assert(
    noAudioUrl === null,
    "Returns null when no audio URL is present in personalizations"
  );

  // Full receipt & transaction mapping test
  const testReceipt: EtsyReceipt = {
    receipt_id: 554433221,
    buyer_email: "audrey.hepburn@example.com",
    name: "Audrey Hepburn",
    first_line: "742 Evergreen Terrace",
    second_line: "Suite 100",
    city: "Springfield",
    state: "OR",
    zip: "97477",
    country_iso: "US",
    was_paid: true,
    grandtotal: {
      amount: 14900,
      divisor: 100,
      currency_code: "USD",
    },
    transactions: [
      {
        transaction_id: 998877665,
        receipt_id: 554433221,
        title: "Large Soundwave Custom Print",
        listing_id: 667788,
        variations: [
          { formatted_name: "Frame Size", formatted_value: '24" x 36" Large' },
          { formatted_name: "Color Palette", formatted_value: "Carrara Marble" },
          { formatted_name: "Decorative Style", formatted_value: "Neoclassical Architectural Arch" },
        ],
        personalizations: [
          { question_text: "Caption Text", value: "Moon River — Breakfast at Tiffany's" },
          { question_text: "Audio Link", value: "https://share.icloud.com/photos/moonriver.m4a" },
        ],
      },
    ],
  };

  const formattedAddr = formatShippingAddress(testReceipt);
  assert(
    formattedAddr === "742 Evergreen Terrace, Suite 100, Springfield, OR, 97477, US",
    "Formats comprehensive shipping address correctly"
  );

  const mappedOrders = mapEtsyReceiptToOrders(testReceipt);
  assert(mappedOrders.length === 1, "Maps receipt with 1 transaction to exactly 1 order");

  const order0 = mappedOrders[0];
  assert(
    order0.partnerOrderId === "etsy_554433221_998877665",
    "partnerOrderId follows etsy_${receiptId}_${transactionId} format"
  );
  assert(order0.frameSize === "24x36", "Mapped frameSize is 24x36");
  assert(order0.palette === "carrara_gold", "Mapped palette is carrara_gold");
  assert(order0.decorativeTheme === "arch", "Mapped decorativeTheme is arch");
  assert(
    order0.caption === "Moon River — Breakfast at Tiffany's",
    "Mapped caption is accurately extracted"
  );
  assert(
    order0.audioPath === "https://share.icloud.com/photos/moonriver.m4a",
    "Mapped audioPath is set to extracted cloud URL"
  );
  assert(
    order0.audioSourceUrl === "https://share.icloud.com/photos/moonriver.m4a",
    "Mapped audioSourceUrl is set to extracted cloud URL"
  );
  assert(order0.customerEmail === "audrey.hepburn@example.com", "Mapped customerEmail matches buyer_email");
  assert(order0.shippingName === "Audrey Hepburn", "Mapped shippingName matches receipt name");
  assert(order0.totalAmount === 14900, "Mapped totalAmount is 14900 cents ($149.00)");
  assert(order0.status === "pending_fulfillment", "Mapped status is pending_fulfillment when was_paid is true");

  // Fallback when no audio is provided
  const noAudioReceipt: EtsyReceipt = {
    ...testReceipt,
    receipt_id: 554433222,
    transactions: [
      {
        ...testReceipt.transactions[0],
        transaction_id: 998877666,
        personalizations: [{ question_text: "Caption", value: "A simple note" }],
      },
    ],
  };
  const mappedNoAudio = mapEtsyReceiptToOrders(noAudioReceipt)[0];
  assert(
    mappedNoAudio.audioPath === "pending_etsy_audio",
    "Missing audio link assigns default 'pending_etsy_audio'"
  );
  assert(
    mappedNoAudio.audioSourceUrl === null,
    "Missing audio link assigns audioSourceUrl: null"
  );

  // ------------------------------------------------------------------------
  // SUITE 4: Live DB Insertion & Deduplication via partnerOrderId
  // ------------------------------------------------------------------------
  console.log("\n--- 4. Live DB Ingestion & Deduplication Check ---");

  const testReceiptId = `test_rc_${Date.now()}`;
  const testTxId = `test_tx_${Date.now()}`;
  const testPartnerOrderId = `etsy_${testReceiptId}_${testTxId}`;

  const syntheticLiveReceipt: EtsyReceipt = {
    receipt_id: testReceiptId,
    buyer_email: "etsy_live_tester@example.com",
    name: "Etsy Live Tester",
    first_line: "123 Integration Way",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    country_iso: "US",
    was_paid: true,
    grandtotal: {
      amount: 9900,
      divisor: 100,
      currency_code: "USD",
    },
    transactions: [
      {
        transaction_id: testTxId,
        receipt_id: testReceiptId,
        title: "SoundWave Keepsake Art 16x20",
        variations: [
          { formatted_name: "Frame Size", formatted_value: "16x20" },
          { formatted_name: "Palette", formatted_value: "Midnight Gold" },
          { formatted_name: "Theme", formatted_value: "Floral Botanical" },
        ],
        personalizations: [
          {
            question_text: "Custom Song & Artist Caption",
            value: "Live DB Ingestion Test — Track 01",
          },
          {
            question_text: "Audio Link",
            value: "https://www.dropbox.com/s/live_test/audio.mp3",
          },
        ],
      },
    ],
  };

  // 1. Ingest order for the first time via POST /api/etsy/orders?mock=true
  const firstPostReq = new NextRequest("http://localhost:3000/api/etsy/orders?mock=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: syntheticLiveReceipt }),
  });

  const firstPostRes = await ordersPostHandler(firstPostReq);
  const firstPostJson = await firstPostRes.json();

  assert(
    firstPostRes.status === 200,
    "Initial order ingestion returns HTTP 200"
  );
  assert(
    firstPostJson.success === true && firstPostJson.synced === 1 && firstPostJson.duplicates === 0,
    "Initial ingestion syncs 1 order with 0 duplicates",
    `Synced: ${firstPostJson.synced}, Duplicates: ${firstPostJson.duplicates}`
  );

  // Verify record directly in PostgreSQL database
  const dbOrder = await getOrderByPartnerOrderId(testPartnerOrderId);
  assert(
    dbOrder !== null,
    "Order successfully inserted and queryable by partnerOrderId in database"
  );
  assert(
    dbOrder?.partnerOrderId === testPartnerOrderId,
    "Database record has correct partnerOrderId"
  );
  assert(
    dbOrder?.source === "etsy",
    "Database record has source='etsy'"
  );
  assert(
    dbOrder?.frameSize === "16x20",
    "Database record has frameSize='16x20'"
  );
  assert(
    dbOrder?.palette === "midnight_gold",
    "Database record has palette='midnight_gold'"
  );
  assert(
    dbOrder?.decorativeTheme === "botanical",
    "Database record has decorativeTheme='botanical'"
  );
  assert(
    dbOrder?.caption === "Live DB Ingestion Test — Track 01",
    "Database record has correct caption"
  );
  assert(
    dbOrder?.totalAmount === 9900,
    "Database record has correct totalAmount (9900 cents)"
  );
  assert(
    dbOrder?.status === "pending_fulfillment",
    "Database record has status='pending_fulfillment' for paid receipt"
  );

  // 2. Re-send exact same receipt to test deduplication
  const secondPostReq = new NextRequest("http://localhost:3000/api/etsy/orders?mock=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: syntheticLiveReceipt }),
  });

  const secondPostRes = await ordersPostHandler(secondPostReq);
  const secondPostJson = await secondPostRes.json();

  assert(
    secondPostRes.status === 200,
    "Duplicate ingestion attempt returns HTTP 200"
  );
  assert(
    secondPostJson.success === true && secondPostJson.synced === 0 && secondPostJson.duplicates === 1,
    "Deduplication triggered: synced 0 new orders and identified 1 duplicate",
    `Synced: ${secondPostJson.synced}, Duplicates: ${secondPostJson.duplicates}`
  );

  // Confirm total count in DB for this partnerOrderId is still exactly 1
  const countInDb = await prisma.order.count({
    where: { partnerOrderId: testPartnerOrderId },
  });
  assert(
    countInDb === 1,
    "Database contains exactly 1 order for partnerOrderId (zero duplicates created)",
    `Count: ${countInDb}`
  );

  // 3. Verify GET /api/etsy/orders?mock=true returns the ingested orders
  const getOrdersReq = new NextRequest("http://localhost:3000/api/etsy/orders?mock=true");
  const getOrdersRes = await ordersGetHandler(getOrdersReq);
  const getOrdersJson = await getOrdersRes.json();

  assert(
    getOrdersRes.status === 200,
    "GET /api/etsy/orders?mock=true returns HTTP 200"
  );
  assert(
    getOrdersJson.success === true && Array.isArray(getOrdersJson.orders),
    "GET /api/etsy/orders?mock=true returns success: true and orders array"
  );
  const foundInGet = getOrdersJson.orders.some(
    (o: any) => o.partnerOrderId === testPartnerOrderId
  );
  assert(
    foundInGet === true,
    "Ingested order is present in GET /api/etsy/orders?mock=true response"
  );

  // Clean up test order
  await prisma.order.deleteMany({
    where: { partnerOrderId: testPartnerOrderId },
  });

  const postCleanupCount = await prisma.order.count({
    where: { partnerOrderId: testPartnerOrderId },
  });
  assert(postCleanupCount === 0, "Test order cleanly pruned from database after verification");

  // Summary
  console.log("\n==================================================");
  console.log(`   ETSY VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

void runEtsyVerificationSuite();
