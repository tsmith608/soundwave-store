import type { JobType } from "./queue";
import { PermanentJobError } from "./queue";

/** Maps job types to their implementation. Imports are lazy so the web process never loads Chromium. */
export async function runJob(type: JobType, payload: Record<string, unknown>, jobKey: string): Promise<void> {
  switch (type) {
    case "render_order": {
      const { renderOrder } = await import("../render/printFiles");
      return renderOrder(String(payload.orderId), { force: Boolean(payload.force) });
    }
    case "submit_fulfillment": {
      const { submitFulfillment } = await import("../fulfillment/service");
      return submitFulfillment(String(payload.orderId));
    }
    case "sync_fulfillment": {
      const { syncFulfillment } = await import("../fulfillment/service");
      return syncFulfillment(String(payload.fulfillmentId));
    }
    case "send_email": {
      const { sendOrderEmail } = await import("../email/jobs");
      return sendOrderEmail(payload as never, jobKey);
    }
    case "process_webhook": {
      const { runStored } = await import("../webhooks");
      await import("../webhookHandlers");
      const res = await runStored(String(payload.webhookEventId));
      if (res.status >= 400) throw new Error(`Webhook reprocessing failed (${res.status})`);
      return;
    }
    case "cleanup": {
      const { runMaintenance } = await import("../maintenance");
      await runMaintenance();
      return;
    }
    default:
      throw new PermanentJobError(`Unknown job type ${type}`);
  }
}
