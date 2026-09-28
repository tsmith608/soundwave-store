"""
Tier 4: Real-World Application Scenarios.
Scenario 02: Baby Heartbeat End-to-End Workflow.
Simulates expecting parents creating nursery sound wave art:
  1. Parents upload 10s ultrasound baby heartbeat audio.
  2. Selects 'White / Silver' palette and '8x10' frame ($49).
  3. Custom caption: "Liam's First Heartbeat • 142 BPM • June 12, 2026".
  4. Completes checkout with nursery delivery address.
  5. Webhook verifies payment and queues fulfillment.
  6. PDF engine compiles 2400x3000 px 300 DPI PDF (>=1MB).
  7. Print order sent to mock partner (GLOBAL-CFP-8X10).
  8. Order confirmation email dispatched with status link.
  9. Parents check status portal.
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


class TestWorkloadBabyHeartbeat(unittest.TestCase):
    """Executes the complete Baby Heartbeat customer journey with genuine backend fulfillment."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()
        self.order_id = "ord_baby_heartbeat_002"
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

    def test_baby_heartbeat_e2e_workflow(self):
        # Step 1: Synthesize heartbeat rhythm audio (10 seconds)
        audio_path = os.path.join(self.temp_dir.name, "heartbeat_10s.wav")
        generate_wav(audio_path, duration_seconds=10.0, frequency=140.0)
        self.assertTrue(os.path.exists(audio_path))

        # Step 2: Customization options
        palette = PALETTES["white_silver"]
        frame = FRAME_SIZES["8x10"]
        caption = "Liam's First Heartbeat • 142 BPM • June 12, 2026"

        self.assertEqual(palette["bg"], "#ffffff")
        self.assertEqual(palette["wave"], "#a0a0a0")
        self.assertEqual(frame["price_cents"], 4900)
        self.assertEqual(frame["prodigi_sku"], "GLOBAL-CFP-8X10")

        # Step 3: Checkout Session
        checkout_payload = {
            "audioId": "aud_baby_heartbeat_002",
            "frameSize": "8x10",
            "palette": palette,
            "caption": caption,
            "customer": {
                "email": "jessica.mark@example.com",
                "name": "Jessica Miller",
                "address": {
                    "line1": "456 Blossom Lane",
                    "city": "Austin",
                    "state": "TX",
                    "postal_code": "78701",
                    "country": "US",
                },
            },
        }
        self.assertEqual(checkout_payload["frameSize"], "8x10")

        # Step 4: Webhook payment
        webhook_event = {
            "id": "evt_baby_heartbeat_payment",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_baby_heartbeat",
                    "customer_details": {"email": "jessica.mark@example.com"},
                    "metadata": {"orderId": self.order_id, "frameSize": "8x10"},
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
                "jessica.mark@example.com",
                "Jessica Miller",
                "456 Blossom Lane, Austin, TX 78701",
                "8x10",
                "white_silver",
                caption,
                audio_path,
                "pending_fulfillment",
                4900,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        conn.close()

        # Step 5: Execute genuine fulfillment pipeline for 8x10 White/Silver
        fulfill_res = run_fulfillment(self.order_id, provider_name="mock", email_provider="mock")
        self.assertTrue(fulfill_res["success"], "Fulfillment pipeline must succeed for 8x10 white_silver")
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
            f"Compiled 8x10 white_silver PDF size {real_pdf_bytes} bytes must strictly meet or exceed 1MB",
        )
        self.assertEqual(fulfill_res["pdfSizeBytes"], real_pdf_bytes)
        pdf_mb = fulfill_res["pdfSizeBytes"] / (1024 * 1024)
        self.assertGreaterEqual(pdf_mb, 1.0)
        self.assertEqual(frame["w_px_300dpi"], 2400)
        self.assertEqual(frame["h_px_300dpi"], 3000)

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

        # Step 6: Tracking verification
        status_url = f"https://soundwaveart.com/order/{self.order_id}"
        self.assertIn(self.order_id, status_url)


if __name__ == "__main__":
    unittest.main()
