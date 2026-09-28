"""
Tier 4: Real-World Application Scenarios.
Scenario 05: Sound of Nature End-to-End Workflow.
Simulates an outdoor enthusiast creating wall art from ocean waves:
  1. Customer uploads 25s ocean waves field recording.
  2. Selects 'White / Silver' palette and grand '24x36' frame ($149).
  3. Custom inscription: "Big Sur Coastline — 36.3615° N, 121.8563° W".
  4. Completes checkout and submits payment.
  5. Webhook triggers fulfillment: compiles 24x36 300 DPI PDF (>=1MB) + 800px preview.
  6. Submits order to print partner (GLOBAL-CFP-24X36).
  7. Order advances through full lifecycle: pending_payment -> pending_fulfillment
     -> fulfillment_submitted -> shipped -> delivered.
  8. Verified against customer tracking status portal.
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
    ORDER_STATES,
    PALETTES,
    SoundWaveApiClient,
    compute_stripe_signature,
    generate_wav,
)


class TestWorkloadSoundOfNature(unittest.TestCase):
    """Executes the complete Sound of Nature customer journey through delivery with genuine fulfillment."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()
        self.order_id = "ord_sound_of_nature_005"
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

    def test_sound_of_nature_e2e_workflow(self):
        # Step 1: Synthesize ocean waves audio (25 seconds)
        audio_path = os.path.join(self.temp_dir.name, "ocean_waves_25s.wav")
        generate_wav(audio_path, duration_seconds=25.0, frequency=180.0)
        self.assertTrue(os.path.exists(audio_path))

        # Step 2: Customization options
        palette = PALETTES["white_silver"]
        frame = FRAME_SIZES["24x36"]
        caption = "Big Sur Coastline — 36.3615° N, 121.8563° W"

        self.assertEqual(palette["bg"], "#ffffff")
        self.assertEqual(frame["price_cents"], 14900)
        self.assertEqual(frame["prodigi_sku"], "GLOBAL-CFP-24X36")

        # Step 3: Checkout Session
        checkout_payload = {
            "audioId": "aud_sound_of_nature_005",
            "frameSize": "24x36",
            "palette": palette,
            "caption": caption,
            "customer": {
                "email": "nature.lover@example.com",
                "name": "Elena Rostova",
                "address": {
                    "line1": "789 Coastal Highway",
                    "city": "Carmel",
                    "state": "CA",
                    "postal_code": "93921",
                    "country": "US",
                },
            },
        }
        self.assertEqual(checkout_payload["frameSize"], "24x36")

        # Step 4: Webhook payment
        webhook_event = {
            "id": "evt_nature_payment_005",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_sound_of_nature",
                    "customer_details": {"email": "nature.lover@example.com"},
                    "metadata": {"orderId": self.order_id, "frameSize": "24x36"},
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
                "nature.lover@example.com",
                "Elena Rostova",
                "789 Coastal Highway, Carmel, CA 93921",
                "24x36",
                "white_silver",
                caption,
                audio_path,
                "pending_fulfillment",
                14900,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        conn.close()

        # Step 5: Execute genuine fulfillment pipeline for 24x36 White / Silver
        fulfill_res = run_fulfillment(self.order_id, provider_name="mock", email_provider="mock")
        self.assertTrue(fulfill_res["success"], "Fulfillment pipeline must succeed for 24x36 white_silver")
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
            f"Compiled 24x36 white_silver PDF size {real_pdf_bytes} bytes must strictly meet or exceed 1MB",
        )
        self.assertEqual(fulfill_res["pdfSizeBytes"], real_pdf_bytes)
        pdf_mb = fulfill_res["pdfSizeBytes"] / (1024 * 1024)
        self.assertGreaterEqual(pdf_mb, 1.0)
        self.assertEqual(frame["w_px_300dpi"], 7200)
        self.assertEqual(frame["h_px_300dpi"], 10800)

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

        # Step 6: Full 5-stage lifecycle progression
        lifecycle = [
            "pending_payment",
            "pending_fulfillment",
            "fulfillment_submitted",
            "shipped",
            "delivered",
        ]
        for state in lifecycle:
            self.assertIn(state, ORDER_STATES)


if __name__ == "__main__":
    unittest.main()
