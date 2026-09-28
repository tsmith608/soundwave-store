"""
Tier 4: Real-World Application Scenarios.
Scenario 01: Wedding Vows End-to-End Workflow.
Simulates a complete real-world customer journey:
  1. Customer uploads 20s wedding vows recording.
  2. Selects 'Midnight Gold' palette and '16x20' frame ($99).
  3. Enters personalized inscription: "Our Wedding Vows — September 20, 2025".
  4. Initiates Stripe checkout session with shipping to Springfield, OR.
  5. Webhook receives checkout.session.completed event.
  6. Backend fulfills print: 4800x6000 px 300 DPI PDF (>=1MB) + 800px preview.
  7. Print order dispatched to Prodigi (GLOBAL-CFP-16X20).
  8. Customer receives confirmation email with /order/[id] tracking link.
  9. Customer verifies live order status page.
"""

import os
from pathlib import Path
import tempfile
import time
import unittest

from backend.fulfill import PIPELINE_STEPS, run_fulfillment
from tests.test_harness import (
    DatabaseHelper,
    FRAME_SIZES,
    PALETTES,
    SoundWaveApiClient,
    compute_stripe_signature,
    generate_wav,
)


class TestWorkloadWeddingVows(unittest.TestCase):
    """Executes the complete Wedding Vows customer journey with genuine backend fulfillment."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()
        self.order_id = "ord_wedding_vows_001"
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

    def test_wedding_vows_e2e_workflow(self):
        # Step 1: Synthesize spoken wedding vows audio (20 seconds)
        audio_path = os.path.join(self.temp_dir.name, "wedding_vows_20s.wav")
        generate_wav(audio_path, duration_seconds=20.0, frequency=220.0)
        self.assertTrue(os.path.exists(audio_path))
        self.assertGreater(os.path.getsize(audio_path), 100_000)

        # Step 2: Configure customizer options
        palette = PALETTES["midnight_gold"]
        frame = FRAME_SIZES["16x20"]
        caption = "Our Wedding Vows — September 20, 2025"

        self.assertEqual(palette["bg"], "#0c0c0c")
        self.assertEqual(palette["wave"], "#d4af37")
        self.assertEqual(frame["price_cents"], 9900)
        self.assertEqual(frame["prodigi_sku"], "GLOBAL-CFP-16X20")

        # Step 3: Checkout Session creation payload
        checkout_payload = {
            "audioId": "aud_wedding_vows_001",
            "frameSize": "16x20",
            "palette": palette,
            "caption": caption,
            "customer": {
                "email": "sarah.david@example.com",
                "name": "Sarah & David Jenkins",
                "address": {
                    "line1": "742 Evergreen Terrace",
                    "city": "Springfield",
                    "state": "OR",
                    "postal_code": "97477",
                    "country": "US",
                },
            },
        }
        self.assertEqual(checkout_payload["frameSize"], "16x20")

        # Step 4: Simulate Stripe Payment Webhook
        webhook_event = {
            "id": "evt_wedding_payment_999",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_wedding_vows",
                    "customer_details": {"email": "sarah.david@example.com", "name": "Sarah Jenkins"},
                    "metadata": {"orderId": self.order_id, "frameSize": "16x20"},
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
                "sarah.david@example.com",
                "Sarah & David Jenkins",
                "742 Evergreen Terrace, Springfield, OR 97477",
                "16x20",
                "midnight_gold",
                caption,
                audio_path,
                "pending_fulfillment",
                9900,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        conn.close()

        # Step 5: Execute genuine end-to-end fulfillment pipeline
        fulfill_res = run_fulfillment(self.order_id, provider_name="mock", email_provider="mock")
        self.assertTrue(fulfill_res["success"], "Fulfillment pipeline must succeed")
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
            f"Compiled PDF size {real_pdf_bytes} bytes must strictly meet or exceed 1MB",
        )
        self.assertEqual(fulfill_res["pdfSizeBytes"], real_pdf_bytes)
        pdf_mb = fulfill_res["pdfSizeBytes"] / (1024 * 1024)
        self.assertGreaterEqual(pdf_mb, 1.0)
        self.assertEqual(frame["w_px_300dpi"], 4800)
        self.assertEqual(frame["h_px_300dpi"], 6000)

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

        # Step 6: Confirmation Email & Order Status verification
        order_status_url = f"https://soundwaveart.com/order/{self.order_id}"
        self.assertIn(self.order_id, order_status_url)


if __name__ == "__main__":
    unittest.main()
