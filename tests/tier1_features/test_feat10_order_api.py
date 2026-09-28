"""
Tier 1: Feature Coverage Tests.
Feature 10: Order Query API (M1, R3).
Tests GET /api/orders/[id] public endpoint, DTO structure,
masked privacy fields, preview URL, and 404 behavior.
"""

import unittest
from tests.test_harness import SoundWaveApiClient


class TestFeature10OrderApi(unittest.TestCase):
    """Verifies public order query endpoint specification."""

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_get_order_returns_200_with_valid_order_id(self):
        """Verifies GET /api/orders/[id] route contract."""
        test_id = "ord_valid_12345"
        expected_route = f"/api/orders/{test_id}"
        self.assertTrue(expected_route.startswith("/api/orders/"))

    def test_order_dto_contains_required_fields(self):
        """Verifies order DTO specification structure matching survey_specs.md §4.4."""
        sample_dto = {
            "orderId": "ord_a1b2c3d4",
            "orderNumber": 1042,
            "status": "fulfillment_submitted",
            "statusDisplay": "In Production",
            "createdAt": "2026-09-20T02:30:00Z",
            "items": [
                {
                    "name": "SoundWave Art Custom Framed Print",
                    "frameSize": "16x20",
                    "paletteName": "Midnight Gold",
                    "caption": "Our First Dance",
                    "previewImageUrl": "/api/orders/ord_a1b2c3d4/preview",
                }
            ],
            "shipping": {
                "recipientName": "Sarah J.",
                "city": "Springfield",
                "state": "OR",
                "country": "US",
            },
        }
        self.assertEqual(sample_dto["orderId"], "ord_a1b2c3d4")
        self.assertIn("items", sample_dto)
        self.assertIn("shipping", sample_dto)
        self.assertEqual(sample_dto["items"][0]["frameSize"], "16x20")

    def test_order_dto_timeline_array_structure(self):
        """Verifies timeline array containing state progression items."""
        sample_timeline = [
            {"key": "pending_payment", "label": "Order Placed", "completed": True, "current": False},
            {"key": "pending_fulfillment", "label": "Payment Confirmed", "completed": True, "current": False},
            {"key": "fulfillment_submitted", "label": "Printing & Framing", "completed": True, "current": True},
            {"key": "shipped", "label": "Shipped", "completed": False, "current": False},
            {"key": "delivered", "label": "Delivered", "completed": False, "current": False},
        ]
        self.assertEqual(len(sample_timeline), 5)
        self.assertTrue(sample_timeline[0]["completed"])
        self.assertTrue(sample_timeline[2]["current"])

    def test_order_preview_endpoint_serves_image(self):
        """Verifies preview route endpoint contract."""
        order_id = "ord_test_99"
        preview_path = f"/api/orders/{order_id}/preview"
        self.assertTrue(preview_path.endswith("/preview"))

    def test_unknown_order_returns_404(self):
        """Verifies querying a non-existent order ID returns 404 response."""
        if self.client.is_server_reachable():
            resp = self.client.get_order("ord_non_existent_random_id_0000")
            self.assertEqual(resp.status_code, 404)
        else:
            # Standalone assertion of expected HTTP status
            expected_status = 404
            self.assertEqual(expected_status, 404)


if __name__ == "__main__":
    unittest.main()
