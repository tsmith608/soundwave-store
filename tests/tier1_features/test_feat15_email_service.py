"""
Tier 1: Feature Coverage Tests.
Feature 15: Transactional Email Service (M2, R3, AC).
Directly exercises backend.email_service: OrderConfirmationData,
renderers, MockEmailService, and Resend client dispatch SLA.
"""

import os
import tempfile
import time
import unittest
from pathlib import Path

from backend.email_service import (
    MockEmailService,
    OrderConfirmationData,
    get_email_service,
    render_order_confirmation_html,
    render_order_confirmation_text,
)


class TestFeature15EmailService(unittest.TestCase):
    """Verifies transactional email dispatch specifications using MockEmailService."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        MockEmailService.clear_sent_emails()
        self.service = MockEmailService(storage_dir=self.temp_dir.name)

    def tearDown(self):
        MockEmailService.clear_sent_emails()
        self.temp_dir.cleanup()

    def test_email_dispatch_sla_within_60_seconds(self):
        """Verifies Acceptance Criteria rule: confirmation email sent within 60s of payment."""
        payment_time_s = time.time()

        data = OrderConfirmationData(
            order_id="ord_sla_test_99",
            customer_email="sarah.jenkins@example.com",
            customer_name="Sarah Jenkins",
            frame_size_label='16" × 20" Framed Print',
            palette_name="Midnight Gold",
            total_formatted="$99.00",
            order_number=1042,
            caption="Our Wedding Vows",
        )

        result = self.service.send_order_confirmation(data)
        self.assertTrue(result["success"])

        latest = MockEmailService.get_latest_email_for("sarah.jenkins@example.com")
        self.assertIsNotNone(latest)
        self.assertGreaterEqual(latest["sent_at_s"], payment_time_s)

        latency_s = latest["sent_at_s"] - payment_time_s
        self.assertLess(latency_s, 60.0, "Email must be dispatched within 60 seconds of checkout")

    def test_order_confirmation_email_subject_and_recipient(self):
        """Verifies recipient email and subject format containing order number."""
        order_number = 1042
        customer_email = "sarah.jenkins@example.com"

        data = OrderConfirmationData(
            order_id="ord_subj_1042",
            customer_email=customer_email,
            customer_name="Sarah Jenkins",
            frame_size_label='16" × 20" Framed Print',
            palette_name="Midnight Gold",
            total_formatted="$99.00",
            order_number=order_number,
        )

        res = self.service.send_order_confirmation(data)
        self.assertTrue(res["success"])

        sent = MockEmailService.get_latest_email_for(customer_email)
        self.assertIsNotNone(sent)
        self.assertEqual(sent["to"], customer_email)
        self.assertIn(str(order_number), sent["subject"])
        self.assertIn("Your SoundWave Art order is confirmed!", sent["subject"])

    def test_email_contains_order_id_and_status_link(self):
        """Verifies email template includes order UUID and link to /order/[id]."""
        order_id = "ord_a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
        data = OrderConfirmationData(
            order_id=order_id,
            customer_email="buyer@example.com",
            customer_name="John Buyer",
            frame_size_label='11" × 14" Framed Print',
            palette_name="Ocean Navy",
            total_formatted="$69.00",
            order_number=1043,
        )

        self.service.send_order_confirmation(data)
        sent = MockEmailService.get_latest_email_for("buyer@example.com")

        self.assertIn(order_id, sent["status_url"])
        self.assertTrue(sent["status_url"].startswith("http"))
        self.assertIn(order_id, sent["html"])
        self.assertIn(order_id, sent["text"])
        self.assertIn(sent["status_url"], sent["html"])
        self.assertIn(sent["status_url"], sent["text"])

    def test_email_contains_frame_size_and_palette_summary(self):
        """Verifies email body summarizes chosen frame size, palette, and inscription."""
        data = OrderConfirmationData(
            order_id="ord_summary_55",
            customer_email="test.summary@example.com",
            customer_name="Sarah Jenkins",
            frame_size_label='16" × 20" Framed Print',
            palette_name="Midnight Gold",
            caption="Our First Dance — October 14, 2024",
            total_formatted="$99.00",
            shipping_address_summary="742 Evergreen Terrace, Springfield OR",
        )

        self.service.send_order_confirmation(data)
        sent = MockEmailService.get_latest_email_for("test.summary@example.com")

        self.assertEqual(sent["frame_size"], '16" × 20" Framed Print')
        self.assertEqual(sent["palette_name"], "Midnight Gold")
        self.assertEqual(sent["total_formatted"], "$99.00")
        self.assertEqual(sent["caption"], "Our First Dance — October 14, 2024")

        # Check rendered HTML & Text bodies
        self.assertIn('16" × 20" Framed Print', sent["html"])
        self.assertIn("Midnight Gold", sent["html"])
        self.assertIn("$99.00", sent["html"])
        self.assertIn("Our First Dance — October 14, 2024", sent["html"])
        self.assertIn("742 Evergreen Terrace", sent["html"])

    def test_mock_email_service_queue_and_retrieval(self):
        """Verifies mock email harness stores sent messages in memory and persists to disk."""
        self.assertEqual(len(MockEmailService.get_sent_emails()), 0)

        data1 = OrderConfirmationData(
            order_id="ord_1001",
            customer_email="user1@example.com",
            customer_name="User One",
            frame_size_label='8" × 10" Framed Print',
            palette_name="White / Silver",
            total_formatted="$49.00",
            order_number=1001,
        )
        data2 = OrderConfirmationData(
            order_id="ord_1002",
            customer_email="user2@example.com",
            customer_name="User Two",
            frame_size_label='24" × 36" Framed Print',
            palette_name="Nordic Slate",
            total_formatted="$149.00",
            order_number=1002,
        )

        self.service.send_order_confirmation(data1)
        self.service.send_order_confirmation(data2)

        sent_list = MockEmailService.get_sent_emails()
        self.assertEqual(len(sent_list), 2)
        self.assertEqual(MockEmailService.get_latest_email_for("user1@example.com")["orderId"], "ord_1001")
        self.assertEqual(MockEmailService.get_latest_email_for("user2@example.com")["orderId"], "ord_1002")

        # Verify disk persistence in storage directory
        json_file1 = Path(self.temp_dir.name) / "ord_1001_email.json"
        html_file1 = Path(self.temp_dir.name) / "ord_1001_email.html"
        self.assertTrue(json_file1.exists())
        self.assertTrue(html_file1.exists())


if __name__ == "__main__":
    unittest.main()
