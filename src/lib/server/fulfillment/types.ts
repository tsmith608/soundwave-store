export interface FulfillmentRecipient {
  name: string;
  email?: string | null;
  phone?: string | null;
  address: { line1: string; line2?: string | null; city: string; state?: string | null; postalCode: string; countryCode: string };
}

export interface FulfillmentItemInput {
  merchantReference: string;
  sku: string;
  copies: number;
  attributes: Record<string, string>;
  /** Publicly fetchable (signed, time-limited) URL of the production print file. */
  assetUrl: string;
}

export interface CreateFulfillmentInput {
  idempotencyKey: string;
  merchantReference: string;
  shippingMethod: string;
  recipient: FulfillmentRecipient;
  items: FulfillmentItemInput[];
  callbackUrl?: string;
}

export type ProviderOrderStatus = "submitted" | "in_production" | "shipped" | "complete" | "cancelled" | "on_hold";

export interface ProviderShipment {
  id: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: Date | null;
  delivered: boolean;
}

export interface ProviderOrderState {
  providerOrderId: string;
  status: ProviderOrderStatus;
  providerStatus: string;
  shipments: ProviderShipment[];
  issues: string[];
  costCents: number | null;
  costCurrency: string | null;
}

export interface FulfillmentProvider {
  readonly name: "prodigi" | "mock";
  createOrder(input: CreateFulfillmentInput): Promise<ProviderOrderState>;
  getOrder(providerOrderId: string): Promise<ProviderOrderState>;
  cancelOrder(providerOrderId: string): Promise<boolean>;
}

/** Errors worth retrying (timeouts, 429, 5xx) vs. errors that need a human (bad SKU, bad address). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
  }
}
