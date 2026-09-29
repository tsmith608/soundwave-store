import { getEnv } from "../env";
import type { FulfillmentProvider } from "./types";

let p: FulfillmentProvider | null = null;
export async function fulfillmentProvider(): Promise<FulfillmentProvider> {
  if (p) return p;
  if (getEnv().fulfillmentProvider === "prodigi") {
    const { ProdigiProvider } = await import("./prodigi");
    p = new ProdigiProvider();
  } else {
    const { MockProvider } = await import("./mock");
    p = new MockProvider();
  }
  return p;
}
export * from "./types";
