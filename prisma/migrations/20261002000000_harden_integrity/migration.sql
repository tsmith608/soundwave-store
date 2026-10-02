-- DropForeignKey
ALTER TABLE "DiscountRedemption" DROP CONSTRAINT "DiscountRedemption_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Fulfillment" DROP CONSTRAINT "Fulfillment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderEvent" DROP CONSTRAINT "OrderEvent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_fulfillmentId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_orderId_fkey";

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Integrity rules the database enforces even if application code has a bug.
-- (Prisma can't express CHECK constraints or triggers, so they live here.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Money is never negative, and refunds never exceed what was charged.
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_nonnegative" CHECK (
  "subtotalCents" >= 0 AND "discountCents" >= 0 AND "shippingCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_refund_within_total" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "totalCents");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_valid" CHECK ("quantity" >= 1 AND "unitPriceCents" >= 0 AND "lineTotalCents" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_amount_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_positive" CHECK ("priceCents" > 0);

-- Discounts: percent codes are 1–100%, nothing negative, usage counters sane.
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_values_valid" CHECK (
  "value" >= 0
  AND ("type"::text <> 'percent' OR "value" BETWEEN 1 AND 100)
  AND "minSubtotalCents" >= 0
  AND "timesRedeemed" >= 0
  AND ("maxRedemptions" IS NULL OR "maxRedemptions" >= 0)
  AND ("maxPerCustomer" IS NULL OR "maxPerCustomer" >= 0)
);

-- The admin audit log is append-only: rows can be added, never changed or removed.
CREATE OR REPLACE FUNCTION audit_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();
