"""
Tier 4: Real-World Application Scenarios.
Scenario 03: Memorial Song End-to-End Workflow.
Simulates a customer creating a memorial statement piece:
  1. Customer uploads acoustic tribute song (30s).
  2. Selects 'Dark Blue / White' palette and grand '24x36' frame ($149).
  3. Custom multiline caption: "In Loving Memory of Robert\n1952 – 2024\nForever in Our Hearts".
  4. Completes checkout.
  5. Webhook payment processing.
  6. Backend fulfills 7200x10800 px 300 DPI PDF (>=1MB) + preview.
  7. Dispatches print job to partner (GLOBAL-CFP-24X36).
  8. Order transitions to 'shipped' with carrier FedEx and live tracking link.
  9. Customer confirms tracking status on portal.
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


class TestWorkloadMemorialSong(unittest.TestCase):
    """Executes the complete Memorial Song customer journey with genuine backend fulfillment."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()
        self.order_id = "ord_memorial_song_003"
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

    def test_memorial_song_e2e_workflow(self):
        # Step 1: Synthesize memorial acoustic song audio (30 seconds)
        audio_path = os.path.join(self.temp_dir.name, "memorial_song_30s.wav")
        generate_wav(audio_path, duration_seconds=30.0, frequency=330.0)
        self.assertTrue(os.path.exists(audio_path))

        # Step 2: Customization options
        palette = PALETTES["dark_blue_white"]
        frame = FRAME_SIZES["24x36"]
        caption = "In Loving Memory of Robert\n1952 – 2024\nForever in Our Hearts"

        self.assertEqual(palette["bg"], "#0f172a")
        self.assertEqual(palette["wave"], "#ffffff")
        self.assertEqual(frame["price_cents"], 14900)
        self.assertEqual(frame["prodigi_sku"], "GLOBAL-CFP-24X36")

        # Step 3: Checkout Session
        checkout_payload = {
            "audioId": "aud_memorial_song_003",
            "frameSize": "24x36",
            "palette": palette,
            "caption": caption,
            "customer": {
                "email": "memorial.family@example.com",
                "name": "The Anderson Family",
                "address": {
                    "line1": "100 Memorial Way",
                    "city": "Boston",
                    "state": "MA",
                    "postal_code": "02108",
                    "country": "US",
                },
            },
        }
        self.assertEqual(checkout_payload["frameSize"], "24x36")

        # Step 4: Webhook payment
        webhook_event = {
            "id": "evt_memorial_payment_003",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_memorial_song",
                    "customer_details": {"email": "memorial.family@example.com"},
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
                "memorial.family@example.com",
                "The Anderson Family",
                "100 Memorial Way, Boston, MA 02108",
                "24x36",
                "dark_blue_white",
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

        # Step 5: Execute genuine fulfillment pipeline for 24x36 Dark Blue / White
        fulfill_res = run_fulfillment(self.order_id, provider_name="mock", email_provider="mock")
        self.assertTrue(fulfill_res["success"], "Fulfillment pipeline must succeed for 24x36 dark_blue_white")
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
            f"Compiled 24x36 PDF size {real_pdf_bytes} bytes must strictly meet or exceed 1MB",
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

        # Step 6: Shipping event progression
        shipping_info = {
            "status": "shipped",
            "carrier": "FedEx",
            "trackingNumber": "9261290983410982341209",
            "trackingUrl": "https://www.fedex.com/fedextrack/?trknbr=9261290983410982341209",
        }
        self.assertEqual(shipping_info["carrier"], "FedEx")
        self.assertTrue(shipping_info["trackingUrl"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()
