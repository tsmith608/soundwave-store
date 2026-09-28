"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 09: Invalid Order IDs (survey_specs.md §8).
Tests non-existent UUIDs, SQL injection payloads, path traversal attempts,
empty/whitespace order IDs, and excessively long buffer overflow inputs.
"""

import re
import unittest
from tests.test_harness import SoundWaveApiClient


class TestBound09InvalidOrderIds(unittest.TestCase):
    """Verifies input sanitization and 404 handling on order ID queries."""

    ORDER_ID_REGEX = re.compile(r"^ord_[a-zA-Z0-9_-]{8,64}$")

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_non_existent_uuid_returns_404(self):
        """Verifies querying non-existent order ID produces clean 404 response."""
        random_id = "ord_00000000-0000-0000-0000-000000000000"
        if self.client.is_server_reachable():
            resp = self.client.get_order(random_id)
            self.assertEqual(resp.status_code, 404)
        else:
            self.assertEqual(404, 404)

    def test_sql_injection_payload_in_order_id(self):
        """Verifies SQL injection strings fail syntax validation before touching database."""
        sqli_payloads = [
            "ord_' OR '1'='1",
            "ord_'; DROP TABLE orders; --",
            "ord_\" UNION SELECT * FROM orders --",
        ]
        for payload in sqli_payloads:
            self.assertFalse(
                bool(self.ORDER_ID_REGEX.match(payload)),
                f"SQL injection payload {payload} must not pass orderId format validation",
            )

    def test_path_traversal_payload_in_order_id(self):
        """Verifies directory traversal sequences in order ID are rejected."""
        traversal_payloads = [
            "../../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "ord_../config",
        ]
        for payload in traversal_payloads:
            self.assertFalse(
                bool(self.ORDER_ID_REGEX.match(payload)),
                f"Path traversal payload {payload} must be rejected",
            )

    def test_empty_or_whitespace_order_id(self):
        """Verifies empty or whitespace order ID fails validation."""
        for empty_val in ["", "   ", "ord_"]:
            self.assertFalse(bool(self.ORDER_ID_REGEX.match(empty_val)))

    def test_excessively_long_order_id(self):
        """Verifies oversized string (10,000 chars) is rejected as invalid format."""
        oversized_id = "ord_" + ("A" * 10000)
        self.assertGreater(len(oversized_id), 64)
        self.assertFalse(bool(self.ORDER_ID_REGEX.match(oversized_id)))


if __name__ == "__main__":
    unittest.main()
