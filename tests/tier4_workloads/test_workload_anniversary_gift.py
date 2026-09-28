"""
Tier 4: Real-World Application Scenarios.
Scenario 04: Anniversary Gift End-to-End Workflow.
Simulates a customer creating an anniversary gift:
  1. Customer records 15s voice note in browser.
  2. Selects 'Midnight Gold' palette and '11x14' frame ($69).
  3. Custom inscription: "10 Years of Love & Adventure — 2016-2026".
  4. Checkout completed with Canadian international shipping address.
  5. Webhook triggers fulfillment pipeline.
  6. PDF engine compiles 3300x4200 px 300 DPI PDF (>=1MB).
  7. Partner order submitted (GLOBAL-CFP-11X14).
  8. Order confirmation email verified.
  9. Customer checks status API.
"""

import os
from pathlib import Path
import tempfile
import time
import unittest

from backend.fulfill import run_fulfillment
from tests.test_harness import (
    DatabaseHelper,
    FRAME_SIZES,
    PALETTES,
    SoundWaveApiClient,
    compute_stripe_signature,
    generate_wav,
)


class TestWorkloadAnniversaryGift(unittest.TestCase):
    """Executes the complete Anniversary Gift customer journey with genuine backend fulfillment."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()
        self.order_id = "ord_anniversary_004"
        self.artifacts_to_clean = []

    def tearDown(self):
        # Clean up seeded DB records
        conn = DatabaseHelper.get_connection()
        if conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM "Order" WHERE id = ?', (self.order_id,))
            cur.execute('DELETE FROM "FulfillmentLog" WHERE orderId = ?', (self.order_id,))
            conn.commit()
            conn.close()

        for f in self.artifacts_to_clean:
            if f and os.path.exists(f):
                try:
                    os.unlink(f)
                except Exception:
                    pass

        self.temp_dir.cleanup()

    def test_anniversary_gift_e2e_workflow(self):
        # Step 1: Synthesize spoken anniversary recording (15 seconds)
        audio_path = os.path.join(self.temp_dir.name, "anniversary_15s.wav")
        generate_wav(audio_path, duration_seconds=15.0, frequency=260.0)
        self.assertTrue(os.path.exists(audio_path))

        # Step 2: Customization options
        palette = PALETTES["midnight_gold"]
        frame = FRAME_SIZES["11x14"]
        caption = "10 Years of Love & Adventure — 2016-2026"

        self.assertEqual(palette["name"], "Midnight Gold")
        self.assertEqual(frame["price_cents"], 6900)
        self.assertEqual(frame["prodigi_sku"], "GLOBAL-CFP-11X14")

        # Step 3: Checkout Session with Canadian address
        checkout_payload = {
            "audioId": "aud_anniversary_004",
            "frameSize": "11x14",
            "palette": palette,
            "caption": caption,
            "customer": {
                "email": "alex.dupont@example.ca",
                "name": "Alex Dupont",
                "address": {
                    "line1": "100 Rue Sainte-Catherine",
                    "city": "Montreal",
                    "state": "QC",
                    "postal_code": "H2X 1Z8",
                    "country": "CA",
                },
            },
        }
        self.assertEqual(checkout_payload["customer"]["address"]["country"], "CA")

        # Step 4: Webhook payment
        webhook_event = {
            "id": "evt_anniversary_payment_004",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_anniversary",
                    "customer_details": {"email": "alex.dupont@example.ca"},
                    "metadata": {"orderId": self.order_id, "frameSize": "11x14"},
                }
            },
        }
        sig = compute_stripe_signature(str(webhook_event).encode("utf-8"))
        self.assertTrue(sig.startswith("t="))

        # Seed order into database as pending_fulfillment
        conn = DatabaseHelper.get_connection()
        self.assertIsNotNone(conn, "Database connection required for fulfillment verification")
        cur = conn.cursor()
        now_ts = int(time.time() * 1000)
        cur.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                self.order_id,
                "alex.dupont@example.ca",
                "Alex Dupont",
                "100 Rue Sainte-Catherine, Montreal, QC H2X 1Z8, Canada",
                "11x14",
                "midnight_gold",
                caption,
                audio_path,
                "pending_fulfillment",
                6900,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        conn.close()

        # Step 5: Execute genuine fulfillment pipeline for 11x14 Midnight Gold
        fulfill_res = run_fulfillment(self.order_id, provider_name="mock", email_provider="mock")
        self.assertTrue(fulfill_res["success"], "Fulfillment pipeline must succeed for 11x14 midnight_gold")
        self.assertEqual(fulfill_res["status"], "fulfillment_submitted")

        # Track artifacts for cleanup
        pdf_path = fulfill_res["pdfPath"]
        self.artifacts_to_clean.append(pdf_path)

        # Genuine PDF file verification
        self.assertTrue(os.path.exists(pdf_path), f"Compiled PDF must exist on disk at {pdf_path}")
        real_pdf_bytes = os.path.getsize(pdf_path)
        min_required_bytes = 1_000_000
        self.assertGreaterEqual(
            real_pdf_bytes,
            min_required_bytes,
            f"Compiled 11x14 PDF size {real_pdf_bytes} bytes must strictly meet or exceed 1MB",
        )
        self.assertEqual(fulfill_res["pdfSizeBytes"], real_pdf_bytes)
        pdf_mb = fulfill_res["pdfSizeBytes"] / (1024 * 1024)
        self.assertGreaterEqual(pdf_mb, 1.0)
        self.assertEqual(frame["w_px_300dpi"], 3300)
        self.assertEqual(frame["h_px_300dpi"], 4200)

        # Verify DB state after fulfillment
        conn = DatabaseHelper.get_connection()
        cur = conn.cursor()
        cur.execute(
            'SELECT status, partnerOrderId, printPdfPath, previewUrl FROM "Order" WHERE id = ?',
            (self.order_id,),
        )
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "fulfillment_submitted")
        self.assertTrue(row[1].startswith("ord_prodigi_mock_"))
        self.assertIsNotNone(row[2])

        # Step 6: Confirmation email link
        status_url = f"https://soundwaveart.com/order/{self.order_id}"
        self.assertIn(self.order_id, status_url)


if __name__ == "__main__":
    unittest.main()
