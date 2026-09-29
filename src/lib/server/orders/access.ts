import { hmac, safeEqual } from "../crypto";
import { getEnv } from "../env";

/**
 * Capability token for order pages linked from emails. Knowing an order id
 * alone is not enough to view an order (prevents enumeration / IDOR).
 */
export function orderAccessToken(orderId: string): string {
  return hmac(orderId, "order-access").slice(0, 32);
}

export function checkOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  return Boolean(token) && safeEqual(token!, orderAccessToken(orderId));
}

export function orderUrl(orderId: string): string {
  return `${getEnv().NEXT_PUBLIC_APP_URL}/order/${orderId}?t=${orderAccessToken(orderId)}`;
}
