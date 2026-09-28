"""
Tier 1: Feature Coverage Tests.
Feature 04: Frame Size & Pricing Selector (R1, AC).
Tests physical dimensions, aspect ratios, pricing tiers ($49, $69, $99, $149),
and print pixel resolutions at 300 DPI.
"""

import unittest
from tests.test_harness import FRAME_SIZES


class TestFeature04FrameSizes(unittest.TestCase):
    """Verifies frame size specifications, aspect ratios, and pricing tiers."""

    def test_8x10_frame_spec_and_pricing(self):
        """Verifies 8x10 frame is $49.00 (4900 cents) with 4:5 aspect ratio and GLOBAL-CFP-8X10 SKU."""
        f = FRAME_SIZES["8x10"]
        self.assertEqual(f["price_cents"], 4900)
        self.assertEqual(f["price_usd"], 49.00)
        self.assertEqual(f["aspect_ratio"], "4:5")
        self.assertAlmostEqual(f["aspect_ratio_float"], 8.0 / 10.0, places=3)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-8X10")

    def test_11x14_frame_spec_and_pricing(self):
        """Verifies 11x14 frame is $69.00 (6900 cents) with 11:14 aspect ratio and GLOBAL-CFP-11X14 SKU."""
        f = FRAME_SIZES["11x14"]
        self.assertEqual(f["price_cents"], 6900)
        self.assertEqual(f["price_usd"], 69.00)
        self.assertEqual(f["aspect_ratio"], "11:14")
        self.assertAlmostEqual(f["aspect_ratio_float"], 11.0 / 14.0, places=3)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-11X14")

    def test_16x20_frame_spec_and_pricing(self):
        """Verifies 16x20 frame is $99.00 (9900 cents) with 4:5 aspect ratio and GLOBAL-CFP-16X20 SKU."""
        f = FRAME_SIZES["16x20"]
        self.assertEqual(f["price_cents"], 9900)
        self.assertEqual(f["price_usd"], 99.00)
        self.assertEqual(f["aspect_ratio"], "4:5")
        self.assertAlmostEqual(f["aspect_ratio_float"], 16.0 / 20.0, places=3)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-16X20")

    def test_24x36_frame_spec_and_pricing(self):
        """Verifies 24x36 frame is $149.00 (14900 cents) with 2:3 aspect ratio and GLOBAL-CFP-24X36 SKU."""
        f = FRAME_SIZES["24x36"]
        self.assertEqual(f["price_cents"], 14900)
        self.assertEqual(f["price_usd"], 149.00)
        self.assertEqual(f["aspect_ratio"], "2:3")
        self.assertAlmostEqual(f["aspect_ratio_float"], 24.0 / 36.0, places=3)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-24X36")

    def test_frame_dimensions_300dpi_pixel_resolution(self):
        """Verifies exact 300 DPI physical pixel calculations: inches * 300 DPI."""
        for size_key, f in FRAME_SIZES.items():
            expected_w_px = f["w_in"] * 300
            expected_h_px = f["h_in"] * 300
            self.assertEqual(f["w_px_300dpi"], expected_w_px)
            self.assertEqual(f["h_px_300dpi"], expected_h_px)


if __name__ == "__main__":
    unittest.main()
