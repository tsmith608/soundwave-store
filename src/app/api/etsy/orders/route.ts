import { NextRequest, NextResponse } from "next/server";
import {
  isEtsyConfigured,
  fetchShopReceipts,
  refreshAccessToken,
  mapEtsyReceiptToOrders,
  EtsyReceipt,
} from "@/lib/etsy";
import {
  prisma,
  getEtsyToken,
  saveEtsyToken,
  getOrderByPartnerOrderId,
  createOrder,
} from "@/lib/db";

/**
 * Generates synthetic Etsy receipts for mock synchronization and verification.
 */
function createSyntheticEtsyReceipts(): EtsyReceipt[] {
  return [
    {
      receipt_id: 394829104,
      buyer_email: "eleanor.vance@example.com",
      name: "Eleanor Vance",
      first_line: "412 Oak Valley Lane",
      second_line: "Apt 4B",
      city: "Austin",
      state: "TX",
      zip: "78704",
      country_iso: "US",
      was_paid: true,
      was_shipped: false,
      grandtotal: {
        amount: 9900,
        divisor: 100,
        currency_code: "USD",
      },
      transactions: [
        {
          transaction_id: 748291048,
          receipt_id: 394829104,
          title: 'SoundWave Custom Canvas Print 16" x 20"',
          listing_id: 182938491,
          variations: [
            { formatted_name: "Frame Size", formatted_value: '16" × 20" Framed Print' },
            { formatted_name: "Color Palette", formatted_value: "Midnight Gold" },
            { formatted_name: "Decorative Style", formatted_value: "Floral Botanical" },
          ],
          personalizations: [
            {
              question_text: "Song title, artist name, or custom caption",
              value: "Our First Dance — At Last (Etta James)",
            },
            {
              question_text: "Link to audio file (Dropbox, Google Drive, iCloud)",
              value: "https://www.dropbox.com/s/sample123/our_first_dance.mp3?dl=0",
            },
          ],
        },
      ],
    },
    {
      receipt_id: 394829105,
      buyer_email: "marcus.brody@example.com",
      name: "Marcus Brody",
      first_line: "100 University Plaza",
      second_line: null,
      city: "Boston",
      state: "MA",
      zip: "02115",
      country_iso: "US",
      was_paid: true,
      was_shipped: false,
      grandtotal: {
        amount: 6900,
        divisor: 100,
        currency_code: "USD",
      },
      transactions: [
        {
          transaction_id: 748291049,
          receipt_id: 394829105,
          title: "Custom Waveform Keepsake Art 11x14",
          listing_id: 182938492,
          variations: [
            { formatted_name: "Dimensions", formatted_value: "11x14" },
            { formatted_name: "Palette", formatted_value: "Ocean Navy" },
            { formatted_name: "Theme", formatted_value: "Modern Double Border" },
          ],
          personalizations: [
            {
              question_text: "Caption Text",
              value: "Happy 10th Anniversary! 2016 - 2026",
            },
          ],
        },
      ],
    },
  ];
}

/**
 * GET: Fetches Etsy orders.
 * Returns { success: false, configured: false, orders: [] } if unconfigured.
 * Returns mock/persisted orders if mock=true.
 */
export async function GET(request: NextRequest) {
  try {
    const isMock =
      request.nextUrl.searchParams.get("mock") === "true" ||
      request.headers.get("x-mock-etsy") === "true";

    if (!isEtsyConfigured() && !isMock) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          orders: [],
          warning: "Etsy API keys not configured. Synchronizer operating in idle mode.",
        },
        { status: 200 }
      );
    }

    if (isMock) {
      const persistedOrders = await prisma.order.findMany({
        where: { source: "etsy" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return NextResponse.json({
        success: true,
        configured: isEtsyConfigured(),
        mock: true,
        count: persistedOrders.length,
        orders: persistedOrders,
      });
    }

    // Live mode: query token and fetch from Etsy API
    const tokenRecord = await getEtsyToken();
    if (!tokenRecord) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "Etsy account not connected. Please authenticate via /api/etsy/oauth/login",
          orders: [],
        },
        { status: 200 }
      );
    }

    let accessToken = tokenRecord.accessToken;
    // Check if token expired (with 60s safety buffer)
    if (new Date(tokenRecord.expiresAt).getTime() - 60000 < Date.now()) {
      const refreshed = await refreshAccessToken(tokenRecord.refreshToken);
      const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
      const updated = await saveEtsyToken({
        shopId: tokenRecord.shopId,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt,
        tokenType: refreshed.token_type || "Bearer",
      });
      accessToken = updated.accessToken;
    }

    if (!tokenRecord.shopId) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "No shop ID associated with stored Etsy token",
          orders: [],
        },
        { status: 400 }
      );
    }

    const receipts = await fetchShopReceipts(tokenRecord.shopId, accessToken, {
      wasPaid: true,
      wasShipped: false,
      limit: 50,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      count: receipts.length,
      receipts,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error fetching Etsy orders",
        orders: [],
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Syncs/ingests Etsy receipts and transactions into database.
 * Supports mock=true for test harnesses and synthetic testing.
 * Enforces deduplication via partnerOrderId.
 */
export async function POST(request: NextRequest) {
  try {
    const isMock =
      request.nextUrl.searchParams.get("mock") === "true" ||
      request.headers.get("x-mock-etsy") === "true";

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const isMockBody = body?.mock === true || isMock;

    if (!isEtsyConfigured() && !isMockBody) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          synced: 0,
          orders: [],
          warning: "Etsy API keys not configured. Synchronizer operating in idle mode.",
        },
        { status: 200 }
      );
    }

    // Determine incoming receipts to process
    let receiptsToProcess: EtsyReceipt[] = [];

    if (body?.receipts && Array.isArray(body.receipts)) {
      receiptsToProcess = body.receipts;
    } else if (body?.receipt && typeof body.receipt === "object") {
      receiptsToProcess = [body.receipt];
    } else if (isMockBody) {
      receiptsToProcess = createSyntheticEtsyReceipts();
    }

    const ingestedOrders = [];
    const duplicateOrders = [];

    for (const receipt of receiptsToProcess) {
      const mappedList = mapEtsyReceiptToOrders(receipt);

      for (const mapped of mappedList) {
        // Enforce deduplication via partnerOrderId
        const existingOrder = await getOrderByPartnerOrderId(mapped.partnerOrderId);

        if (existingOrder) {
          duplicateOrders.push({
            partnerOrderId: mapped.partnerOrderId,
            orderId: existingOrder.id,
            status: existingOrder.status,
            reason: "Already ingested (deduplicated)",
          });
          continue;
        }

        // Insert new order into PostgreSQL
        const newOrder = await createOrder({
          customerEmail: mapped.customerEmail,
          shippingName: mapped.shippingName,
          shippingAddress: mapped.shippingAddress,
          frameSize: mapped.frameSize,
          palette: mapped.palette,
          decorativeTheme: mapped.decorativeTheme,
          caption: mapped.caption,
          audioPath: mapped.audioPath,
          audioSourceUrl: mapped.audioSourceUrl,
          totalAmount: mapped.totalAmount,
          source: mapped.source,
          partnerOrderId: mapped.partnerOrderId,
          externalOrderId: mapped.externalOrderId,
          personalizationData: mapped.personalizationData,
          etsyReceiptId: mapped.etsyReceiptId,
          etsyListingId: mapped.etsyListingId,
          status: mapped.status,
        });

        ingestedOrders.push(newOrder);
      }
    }

    return NextResponse.json({
      success: true,
      configured: isEtsyConfigured(),
      mock: isMockBody,
      synced: ingestedOrders.length,
      duplicates: duplicateOrders.length,
      orders: ingestedOrders,
      duplicateOrders,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error syncing Etsy orders",
        synced: 0,
      },
      { status: 500 }
    );
  }
}
