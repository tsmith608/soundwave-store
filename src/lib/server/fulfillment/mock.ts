import { prisma } from "../db";
import { ProviderError, type CreateFulfillmentInput, type FulfillmentProvider, type ProviderOrderState } from "./types";

/**
 * Development/test stand-in for a print lab. Orders progress with time
 * (submitted → in production after 1 min → shipped after 2 min) so the whole
 * lifecycle, emails and tracking can be exercised locally. Set
 * MOCK_FULFILLMENT_FAIL=true to simulate a lab outage.
 */
export class MockProvider implements FulfillmentProvider {
  readonly name = "mock" as const;

  async createOrder(input: CreateFulfillmentInput): Promise<ProviderOrderState> {
    if (process.env.MOCK_FULFILLMENT_FAIL === "true") throw new ProviderError("Mock lab is down (MOCK_FULFILLMENT_FAIL=true)", true, 503);
    if (!input.items.every((i) => i.assetUrl && i.sku)) throw new ProviderError("Missing asset or SKU", false, 400);
    // Idempotent like a real lab: the same key returns the same order.
    return this.state(`mock_${input.idempotencyKey.replace(/[^\w]/g, "").slice(-24)}`, new Date());
  }

  async getOrder(id: string) {
    const f = await prisma.fulfillment.findUnique({ where: { providerOrderId: id } });
    return this.state(id, f?.submittedAt ?? new Date());
  }

  async cancelOrder() {
    return true;
  }

  private state(id: string, submittedAt: Date): ProviderOrderState {
    const speed = Number(process.env.MOCK_FULFILLMENT_SPEED_MS || 60_000);
    const age = Date.now() - submittedAt.getTime();
    const shipped = age > 2 * speed;
    return {
      providerOrderId: id,
      status: shipped ? "shipped" : age > speed ? "in_production" : "submitted",
      providerStatus: shipped ? "Complete" : "InProgress",
      shipments: shipped
        ? [{ id: `${id}_s1`, carrier: "USPS", service: "Ground Advantage", trackingNumber: `9400${id.replace(/\D/g, "").padEnd(18, "0").slice(0, 18)}`, trackingUrl: "https://tools.usps.com/go/TrackConfirmAction", shippedAt: new Date(), delivered: age > 4 * speed }]
        : [],
      issues: [],
      costCents: 4200,
      costCurrency: "USD",
    };
  }
}
