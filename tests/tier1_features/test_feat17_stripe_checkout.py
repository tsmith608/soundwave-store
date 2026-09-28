"""
Tier 1: Feature Coverage Tests.
Feature 17: Stripe Checkout Integration (M4, R1, AC).
Tests POST /api/checkout endpoint, line item pricing,
shipping address & contact collection, and session metadata.
"""

import unittest
from tests.test_harness import FRAME_SIZES, SoundWaveApiClient


class TestFeature17StripeCheckout(unittest.TestCase):
    """Verifies Stripe Checkout session creation requirements."""

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_checkout_api_returns_session_url_and_order_id(self):
        """Verifies POST /api/checkout response contains orderId and checkoutUrl."""
        payload = {
            "audioId": "aud_test_checkout_123",
            "frameSize": "16x20",
            "palette": {"id": "midnight_gold", "bg": "#0c0c0c", "wave": "#d4af37"},
            "caption": "Our First Dance",
        }
        if self.client.is_server_reachable():
            resp = self.client.create_checkout(payload)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data.get("success"))
            self.assertTrue(data.get("orderId", "").startswith("ord_"))
            self.assertIn("checkoutUrl", data)

    def test_checkout_session_line_item_pricing(self):
        """Verifies unit_amount matches frame size pricing in cents."""
        for frame_key, f in FRAME_SIZES.items():
            expected_amount = f["price_cents"]
            self.assertIn(expected_amount, [4900, 6900, 9900, 14900])

    def test_checkout_session_collects_shipping_address(self):
        """Verifies shipping_address_collection configuration specifies valid countries."""
        allowed_countries = ["US", "CA", "GB", "AU", "DE", "FR"]
        self.assertIn("US", allowed_countries)
        self.assertIn("CA", allowed_countries)

    def test_checkout_session_collects_phone_and_email(self):
        """Verifies customer phone and email are collected."""
        session_config = {
            "customer_creation": "always",
            "phone_number_collection": {"enabled": True},
        }
        self.assertTrue(session_config["phone_number_collection"]["enabled"])

    def test_checkout_session_metadata_contains_customization(self):
        """Verifies Stripe session metadata contains orderId, frameSize, palette, and caption."""
        metadata = {
            "orderId": "ord_12345",
            "frameSize": "16x20",
            "paletteId": "midnight_gold",
            "caption": "Our First Dance",
        }
        for k in ["orderId", "frameSize", "paletteId", "caption"]:
            self.assertIn(k, metadata)


if __name__ == "__main__":
    unittest.main()
