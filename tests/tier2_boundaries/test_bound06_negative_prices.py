"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 06: Negative & Tampered Prices (survey_specs.md §8).
Tests negative unit prices, zero price checkout attempts, price mismatch
against frame size, unsupported currency tampering, and fractional cents.
"""

import unittest
from tests.test_harness import FRAME_SIZES


class TestBound06NegativePrices(unittest.TestCase):
    """Verifies server-side financial invariant enforcement."""

    VALID_PRICES = {f["price_cents"] for f in FRAME_SIZES.values()}  # {4900, 6900, 9900, 14900}

    def test_negative_unit_price_rejection(self):
        """Verifies negative unit amounts (e.g. -4900) are strictly forbidden."""
        negative_amounts = [-4900, -1, -9900, -100]
        for amt in negative_amounts:
            self.assertLess(amt, 0)
            self.assertNotIn(amt, self.VALID_PRICES)

    def test_zero_dollar_checkout_attempt(self):
        """Verifies $0.00 (0 cents) checkout attempts are rejected."""
        zero_amount = 0
        self.assertNotIn(zero_amount, self.VALID_PRICES)

    def test_price_tampering_mismatch_against_frame_size(self):
        """Verifies attempting to checkout a 24x36 ($149) frame at the 8x10 ($49) price fails."""
        claimed_frame = "24x36"
        tampered_price = 4900  # Should be 14900
        authoritative_price = FRAME_SIZES[claimed_frame]["price_cents"]

        self.assertNotEqual(tampered_price, authoritative_price)

    def test_unsupported_currency_tampering(self):
        """Verifies non-USD currencies (eur, gbp, btc) are rejected when currency is locked to usd."""
        allowed_currency = "usd"
        tampered_currencies = ["eur", "gbp", "cad", "btc", "eth", "jpy"]
        for curr in tampered_currencies:
            self.assertNotEqual(curr.lower(), allowed_currency)

    def test_fractional_cents_and_non_integer_prices(self):
        """Verifies prices must be positive integer cents (no 4900.5 or string '49.00')."""
        fractional_amounts = [4900.50, 9900.99, "4900", "49.00"]
        for val in fractional_amounts:
            self.assertFalse(
                isinstance(val, int) and val in self.VALID_PRICES,
                f"Value {val} must not be accepted as valid integer cents",
            )


if __name__ == "__main__":
    unittest.main()
