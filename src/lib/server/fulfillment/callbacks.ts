import { prisma } from "../db";
import { log } from "../log";
import { applyProviderState } from "./service";
import { fulfillmentProvider } from "./index";

/**
 * Prodigi callbacks (CloudEvents). Prodigi does not sign callbacks, so the
 * body is treated only as a hint: we take the order id from it and fetch the
 * authoritative state from the Prodigi API before changing anything.
 */
export async function handleProdigiCallback(payload: unknown): Promise<"processed" | "ignored"> {
  const p = payload as { data?: { order?: { id?: string } }; order?: { id?: string } };
  const providerOrderId = p?.data?.order?.id ?? p?.order?.id;
  if (!providerOrderId) return "ignored";
  const f = await prisma.fulfillment.findUnique({ where: { providerOrderId } });
  if (!f) {
    log.warn("prodigi_callback_unknown_order", { providerOrderId });
    return "ignored";
  }
  const state = await (await fulfillmentProvider()).getOrder(providerOrderId);
  await applyProviderState(f.id, state, "callback");
  return "processed";
}
