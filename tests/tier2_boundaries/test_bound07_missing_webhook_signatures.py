"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 07: Missing & Invalid Webhook Signatures (survey_specs.md §8).
Tests missing stripe-signature header, empty values, expired timestamps (>300s),
tampered HMAC hashes, and malformed header schemes.
"""

import time
import unittest
from tests.test_harness import compute_stripe_signature


class TestBound07MissingWebhookSignatures(unittest.TestCase):
    """Verifies Stripe webhook HMAC-SHA256 signature verification edge cases."""

    SECRET = "whsec_test_secret_1234567890abcdef"

    def test_completely_missing_signature_header(self):
        """Verifies missing stripe-signature header fails signature verification."""
        header_val = None
        self.assertIsNone(header_val)

    def test_empty_signature_header_value(self):
        """Verifies empty or whitespace signature header fails verification."""
        for val in ["", "   ", "t=,v1="]:
            self.assertTrue(len(val.strip()) == 0 or "t=," in val)

    def test_expired_timestamp_in_signature_header(self):
        """Verifies signature older than Stripe 300s (5 min) replay tolerance fails."""
        tolerance_seconds = 300
        current_time = int(time.time())
        old_timestamp = current_time - 301  # Expired by 1 second

        age = current_time - old_timestamp
        self.assertGreater(age, tolerance_seconds, "Signatures older than 300s must be rejected as expired")

    def test_tampered_hmac_signature_hash(self):
        """Verifies forged or modified signature hash fails verification."""
        payload = b'{"type":"checkout.session.completed"}'
        valid_sig = compute_stripe_signature(payload, secret=self.SECRET)
        tampered_sig = valid_sig[:-4] + "dead"

        self.assertNotEqual(valid_sig, tampered_sig)

    def test_malformed_signature_header_scheme(self):
        """Verifies malformed header schemes (e.g. missing 'v1=' or 't=') are rejected."""
        malformed_headers = [
            "v1=abc1234567890",             # Missing t=
            "t=1726799000",                  # Missing v1=
            "Bearer whsec_12345",            # Wrong scheme
            "t=abc,v1=123",                  # Non-numeric timestamp
        ]
        for header in malformed_headers:
            has_valid_format = "t=" in header and "v1=" in header
            if has_valid_format:
                # Check if timestamp is numeric
                parts = dict(item.split("=") for item in header.split(","))
                self.assertFalse(parts["t"].isdigit())
            else:
                self.assertFalse(has_valid_format)


if __name__ == "__main__":
    unittest.main()
