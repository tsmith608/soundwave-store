import { getEnv } from "../env";
import { ProviderError, type CreateFulfillmentInput, type FulfillmentProvider, type ProviderOrderState, type ProviderShipment } from "./types";

/**
 * Prodigi Print API v4 (https://www.prodigi.com/print-api/docs/reference/).
 * Sandbox: https://api.sandbox.prodigi.com/v4.0 (free test orders, never printed).
 * ⚠ Field names below follow the v4 reference as documented; verify against a
 * sandbox order before going live (docs/operations.md → "Prodigi sandbox test").
 */
interface ProdigiOrder {
  id: string;
  status?: { stage?: string; issues?: { errorCode?: string; description?: string }[]; details?: Record<string, string> };
  shipments?: {
    id: string;
    status?: string;
    carrier?: { name?: string; service?: string };
    tracking?: { number?: string; url?: string };
    dispatchDate?: string;
  }[];
  charges?: { totalCost?: { amount?: string; currency?: string } }[];
}

export class ProdigiProvider implements FulfillmentProvider {
  readonly name = "prodigi" as const;
  private base: string;
  private key: string;

  constructor() {
    const e = getEnv();
    this.base = e.PRODIGI_ENV === "live" ? "https://api.prodigi.com/v4.0" : "https://api.sandbox.prodigi.com/v4.0";
    this.key = e.PRODIGI_API_KEY!;
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ outcome?: string; order?: ProdigiOrder }> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { "X-API-Key": this.key, "content-type": "application/json", accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new ProviderError(`Prodigi unreachable: ${(e as Error).message}`, true);
    }
    const text = await res.text();
    let json: { outcome?: string; order?: ProdigiOrder; failures?: unknown; traceParent?: string } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const detail = json.failures ? JSON.stringify(json.failures).slice(0, 800) : text.slice(0, 400);
      throw new ProviderError(`Prodigi ${res.status}: ${json.outcome ?? ""} ${detail}`.trim(), res.status === 429 || res.status >= 500, res.status);
    }
    return json;
  }

  async createOrder(input: CreateFulfillmentInput): Promise<ProviderOrderState> {
    const r = input.recipient;
    const json = await this.call("POST", "/Orders", {
      merchantReference: input.merchantReference,
      idempotencyKey: input.idempotencyKey,
      shippingMethod: input.shippingMethod,
      callbackUrl: input.callbackUrl,
      recipient: {
        name: r.name,
        email: r.email ?? undefined,
        phoneNumber: r.phone ?? undefined,
        address: {
          line1: r.address.line1,
          line2: r.address.line2 ?? undefined,
          postalOrZipCode: r.address.postalCode,
          countryCode: r.address.countryCode,
          townOrCity: r.address.city,
          stateOrCounty: r.address.state ?? undefined,
        },
      },
      items: input.items.map((i) => ({
        merchantReference: i.merchantReference,
        sku: i.sku,
        copies: i.copies,
        sizing: "fillPrintArea",
        attributes: Object.keys(i.attributes).length ? i.attributes : undefined,
        assets: [{ printArea: "default", url: i.assetUrl }],
      })),
    });
    if (!json.order?.id) throw new ProviderError(`Prodigi did not return an order (${json.outcome ?? "no outcome"})`, false);
    return mapOrder(json.order);
  }

  async getOrder(id: string) {
    const json = await this.call("GET", `/Orders/${encodeURIComponent(id)}`);
    if (!json.order) throw new ProviderError("Prodigi returned no order", true);
    return mapOrder(json.order);
  }

  async cancelOrder(id: string) {
    try {
      await this.call("POST", `/Orders/${encodeURIComponent(id)}/actions/cancel`);
      return true;
    } catch (e) {
      if (e instanceof ProviderError && !e.retryable) return false; // already in production
      throw e;
    }
  }
}

export function mapOrder(o: ProdigiOrder): ProviderOrderState {
  const stage = o.status?.stage ?? "InProgress";
  const details = o.status?.details ?? {};
  const shipments: ProviderShipment[] = (o.shipments ?? []).map((s) => ({
    id: s.id,
    carrier: s.carrier?.name ?? null,
    service: s.carrier?.service ?? null,
    trackingNumber: s.tracking?.number ?? null,
    trackingUrl: s.tracking?.url ?? null,
    shippedAt: s.dispatchDate ? new Date(s.dispatchDate) : null,
    delivered: /delivered/i.test(s.status ?? ""),
  }));
  let status: ProviderOrderState["status"] = "submitted";
  if (stage === "Cancelled") status = "cancelled";
  else if (stage === "Complete") status = "complete";
  else if (shipments.length) status = "shipped";
  else if (details.inProduction === "InProgress" || details.inProduction === "Complete") status = "in_production";
  const issues = (o.status?.issues ?? []).map((i) => `${i.errorCode ?? "issue"}: ${i.description ?? ""}`.trim());
  if (issues.length && status === "submitted") status = "on_hold";
  const charge = o.charges?.[0]?.totalCost;
  return {
    providerOrderId: o.id,
    status,
    providerStatus: stage + (details.inProduction ? ` / production ${details.inProduction}` : ""),
    shipments,
    issues,
    costCents: charge?.amount ? Math.round(Number(charge.amount) * 100) : null,
    costCurrency: charge?.currency ?? null,
  };
}
