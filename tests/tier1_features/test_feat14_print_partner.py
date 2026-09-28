"""
Tier 1: Feature Coverage Tests.
Feature 14: Print Partner REST Client (M2, R2, AC).
Tests Prodigi v4.0 API integration, SKU mapping, mock fulfillment provider,
and error handling (no silent failures) using backend.print_partner.
"""

import unittest
from backend.print_partner import (
    FRAME_SKU_MAPPINGS,
    FulfillmentItem,
    FulfillmentOrderRequest,
    MockFulfillmentProvider,
    Recipient,
    RecipientAddress,
)
from tests.test_harness import FRAME_SIZES


class TestFeature14PrintPartner(unittest.TestCase):
    """Verifies print partner API client specifications using production models and provider."""

    def setUp(self):
        MockFulfillmentProvider.clear()
        self.provider = MockFulfillmentProvider()

    def test_prodigi_v4_order_payload_structure(self):
        """Verifies Prodigi v4.0 JSON structure matches contract."""
        address = RecipientAddress(
            line1="742 Evergreen Terrace",
            city="Springfield",
            state_or_county="OR",
            postal_or_zip_code="97477",
            country_code="US",
        )
        recipient = Recipient(
            name="Sarah Jenkins",
            email="sarah.jenkins@example.com",
            address=address,
        )
        item = FulfillmentItem(
            sku="GLOBAL-CFP-16X20",
            copies=1,
            sizing="fillPrintArea",
            assets=[{"printArea": "default", "url": "https://storage.soundwaveart.com/prints/ord_123.pdf"}],
        )
        req = FulfillmentOrderRequest(
            internal_order_id="ord_123",
            recipient=recipient,
            items=[item],
            shipping_method="Standard",
        )
        payload = req.to_prodigi_payload()

        self.assertIn("shippingMethod", payload)
        self.assertIn("recipient", payload)
        self.assertIn("items", payload)
        self.assertEqual(payload["items"][0]["sizing"], "fillPrintArea")
        self.assertEqual(payload["items"][0]["sku"], "GLOBAL-CFP-16X20")

    def test_prodigi_sku_mapping_table(self):
        """Verifies Prodigi SKU mappings for all frame sizes in production FRAME_SKU_MAPPINGS."""
        expected_skus = {
            "8x10": "GLOBAL-CFP-8X10",
            "11x14": "GLOBAL-CFP-11X14",
            "16x20": "GLOBAL-CFP-16X20",
            "24x36": "GLOBAL-CFP-24X36",
        }
        for frame, expected_sku in expected_skus.items():
            self.assertEqual(FRAME_SKU_MAPPINGS[frame]["prodigi_sku"], expected_sku)
            self.assertEqual(FRAME_SIZES[frame]["prodigi_sku"], expected_sku)

    def test_mock_fulfillment_provider_success(self):
        """Verifies mock fulfillment provider returns realistic partner order ID and creates order."""
        address = RecipientAddress(
            line1="100 Main St",
            city="Cambridge",
            state_or_county="MA",
            postal_or_zip_code="02138",
            country_code="US",
        )
        recipient = Recipient(
            name="Alice Test",
            email="alice@example.com",
            address=address,
        )
        item = FulfillmentItem(
            sku="GLOBAL-CFP-8X10",
            copies=1,
            assets=[{"url": "https://example.com/test.pdf"}],
        )
        req = FulfillmentOrderRequest(
            internal_order_id="ord_mock_test_001",
            recipient=recipient,
            items=[item],
        )
        resp = self.provider.create_order(req)

        self.assertTrue(resp.success)
        self.assertEqual(resp.outcome, "Created")
        self.assertIsNotNone(resp.partner_order_id)
        self.assertTrue(resp.partner_order_id.startswith("ord_prodigi_mock_"))

        # Verify stored in mock provider
        submitted = MockFulfillmentProvider.get_submitted_orders()
        self.assertEqual(len(submitted), 1)
        self.assertEqual(submitted[0]["order"]["internalOrderId"], "ord_mock_test_001")

    def test_partner_error_handling_no_silent_fail(self):
        """Verifies partner API failures are reported with descriptive errors rather than silently swallowed."""
        # Empty recipient name should trigger validation error
        address = RecipientAddress(
            line1="100 Main St",
            city="Cambridge",
            postal_or_zip_code="02138",
            country_code="US",
        )
        recipient = Recipient(
            name="",  # invalid empty name
            email="bad@example.com",
            address=address,
        )
        req = FulfillmentOrderRequest(
            internal_order_id="ord_bad_001",
            recipient=recipient,
            items=[],
        )
        resp = self.provider.create_order(req)

        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertGreater(len(resp.errors), 0)
        self.assertIn("Recipient name is required", resp.errors[0])

    def test_partner_tracking_event_parsing(self):
        """Verifies parsing shipment tracking details from partner response."""
        address = RecipientAddress(
            line1="742 Evergreen Terrace",
            city="Springfield",
            state_or_county="OR",
            postal_or_zip_code="97477",
            country_code="US",
        )
        recipient = Recipient(
            name="Sarah Jenkins",
            email="sarah.jenkins@example.com",
            address=address,
        )
        item = FulfillmentItem(
            sku="GLOBAL-CFP-16X20",
            copies=1,
            assets=[{"url": "https://storage.soundwaveart.com/prints/ord_123.pdf"}],
        )
        req = FulfillmentOrderRequest(
            internal_order_id="ord_track_test",
            recipient=recipient,
            items=[item],
        )
        create_resp = self.provider.create_order(req)
        self.assertTrue(create_resp.success)

        status_resp = self.provider.get_order_status(create_resp.partner_order_id)
        self.assertTrue(status_resp.success)
        self.assertGreater(len(status_resp.shipments), 0)

        shipment = status_resp.shipments[0]
        self.assertEqual(shipment.carrier_name, "FedEx")
        self.assertTrue(shipment.tracking_number.startswith("926129"))
        self.assertTrue(shipment.tracking_url.startswith("https://www.fedex.com/"))


if __name__ == "__main__":
    unittest.main()
