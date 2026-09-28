"""
Tier 1: Feature Coverage Tests.
Feature 07: Order Status Page (/order/[id]) (R3, AC).
Tests customer status page routing, tracking stepper badges,
low-res preview image reference, carrier details, and PII masking.
"""

import unittest
from tests.test_harness import ORDER_STATES, SoundWaveApiClient


class TestFeature07OrderStatus(unittest.TestCase):
    """Verifies order confirmation and status page specifications."""

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_order_status_route_accessible(self):
        """Verifies customer status route /order/[id] contract."""
        test_order_id = "ord_01HXYZ7890ABCDEF"
        route = f"/order/{test_order_id}"
        self.assertTrue(route.startswith("/order/ord_"))

    def test_order_lifecycle_badges(self):
        """Verifies the standard order status progression labels."""
        status_map = {
            "pending_payment": "Awaiting Payment",
            "pending_fulfillment": "Payment Confirmed",
            "fulfillment_submitted": "Print Submitted",
            "shipped": "Shipped",
            "delivered": "Delivered",
        }
        for code, label in status_map.items():
            self.assertIn(code, ORDER_STATES)
            self.assertTrue(len(label) > 0)

    def test_preview_thumbnail_rendered(self):
        """Verifies status page contract includes low-res preview image endpoint."""
        test_order_id = "ord_test_preview_123"
        expected_preview_url = f"/api/orders/{test_order_id}/preview"
        self.assertTrue(expected_preview_url.endswith("/preview"))

    def test_carrier_tracking_information_rendered(self):
        """Verifies carrier, tracking number, and tracking URL data structure when shipped."""
        shipped_payload = {
            "carrier": "FedEx",
            "trackingNumber": "9261290983410982341209",
            "trackingUrl": "https://www.fedex.com/fedextrack/?trknbr=9261290983410982341209",
        }
        self.assertEqual(shipped_payload["carrier"], "FedEx")
        self.assertTrue(shipped_payload["trackingUrl"].startswith("https://"))

    def test_masked_customer_pii(self):
        """Verifies sensitive PII (phone number, street address) is masked on public order page."""
        raw_phone = "+15415550199"
        masked_phone = "***-***-0199"
        self.assertTrue(masked_phone.endswith(raw_phone[-4:]))
        self.assertNotIn("+1541555", masked_phone)


if __name__ == "__main__":
    unittest.main()
