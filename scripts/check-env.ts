/** Validates the environment the way production boot does. Exit 1 on problems. */
import "./_env";
import { getEnv } from "../src/lib/server/env";

try {
  const e = getEnv();
  console.log(`OK — payments=${e.paymentsProvider} fulfillment=${e.fulfillmentProvider}${e.fulfillmentProvider === "prodigi" ? `(${e.PRODIGI_ENV})` : ""} email=${e.emailProvider} storage=${e.STORAGE_DRIVER} tax=${e.STRIPE_TAX_ENABLED ? "stripe" : "off"} admins=${e.ADMIN_EMAILS.length}`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
