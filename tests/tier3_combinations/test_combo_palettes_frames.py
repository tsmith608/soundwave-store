"""
Tier 3: Cross-Feature Combinations Tests.
Combination 01: Pairwise Palette × Frame Size Permutations.
Tests all 12 permutations (3 palettes × 4 frame sizes) to verify
geometric dimensions, aspect ratios, color configurations, SKUs, and pricing.
"""

import unittest
from tests.test_harness import FRAME_SIZES, PALETTES


class TestComboPalettesFrames(unittest.TestCase):
    """Verifies all 12 pairwise permutations of palettes and frame sizes."""

    # 1. Midnight Gold × 8x10
    def test_permutation_midnight_gold_8x10(self):
        p = PALETTES["midnight_gold"]
        f = FRAME_SIZES["8x10"]
        self.assertEqual(p["bg"], "#0c0c0c")
        self.assertEqual(p["wave"], "#d4af37")
        self.assertEqual(f["price_cents"], 4900)
        self.assertEqual(f["aspect_ratio"], "4:5")
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-8X10")

    # 2. Midnight Gold × 11x14
    def test_permutation_midnight_gold_11x14(self):
        p = PALETTES["midnight_gold"]
        f = FRAME_SIZES["11x14"]
        self.assertEqual(p["bg"], "#0c0c0c")
        self.assertEqual(p["wave"], "#d4af37")
        self.assertEqual(f["price_cents"], 6900)
        self.assertEqual(f["aspect_ratio"], "11:14")
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-11X14")

    # 3. Midnight Gold × 16x20
    def test_permutation_midnight_gold_16x20(self):
        p = PALETTES["midnight_gold"]
        f = FRAME_SIZES["16x20"]
        self.assertEqual(p["bg"], "#0c0c0c")
        self.assertEqual(p["wave"], "#d4af37")
        self.assertEqual(f["price_cents"], 9900)
        self.assertEqual(f["aspect_ratio"], "4:5")
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-16X20")

    # 4. Midnight Gold × 24x36
    def test_permutation_midnight_gold_24x36(self):
        p = PALETTES["midnight_gold"]
        f = FRAME_SIZES["24x36"]
        self.assertEqual(p["bg"], "#0c0c0c")
        self.assertEqual(p["wave"], "#d4af37")
        self.assertEqual(f["price_cents"], 14900)
        self.assertEqual(f["aspect_ratio"], "2:3")
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-24X36")

    # 5. White / Silver × 8x10
    def test_permutation_white_silver_8x10(self):
        p = PALETTES["white_silver"]
        f = FRAME_SIZES["8x10"]
        self.assertEqual(p["bg"], "#ffffff")
        self.assertEqual(p["wave"], "#a0a0a0")
        self.assertEqual(f["price_cents"], 4900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-8X10")

    # 6. White / Silver × 11x14
    def test_permutation_white_silver_11x14(self):
        p = PALETTES["white_silver"]
        f = FRAME_SIZES["11x14"]
        self.assertEqual(p["bg"], "#ffffff")
        self.assertEqual(p["wave"], "#a0a0a0")
        self.assertEqual(f["price_cents"], 6900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-11X14")

    # 7. White / Silver × 16x20
    def test_permutation_white_silver_16x20(self):
        p = PALETTES["white_silver"]
        f = FRAME_SIZES["16x20"]
        self.assertEqual(p["bg"], "#ffffff")
        self.assertEqual(p["wave"], "#a0a0a0")
        self.assertEqual(f["price_cents"], 9900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-16X20")

    # 8. White / Silver × 24x36
    def test_permutation_white_silver_24x36(self):
        p = PALETTES["white_silver"]
        f = FRAME_SIZES["24x36"]
        self.assertEqual(p["bg"], "#ffffff")
        self.assertEqual(p["wave"], "#a0a0a0")
        self.assertEqual(f["price_cents"], 14900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-24X36")

    # 9. Dark Blue / White × 8x10
    def test_permutation_dark_blue_white_8x10(self):
        p = PALETTES["dark_blue_white"]
        f = FRAME_SIZES["8x10"]
        self.assertEqual(p["bg"], "#0f172a")
        self.assertEqual(p["wave"], "#ffffff")
        self.assertEqual(f["price_cents"], 4900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-8X10")

    # 10. Dark Blue / White × 11x14
    def test_permutation_dark_blue_white_11x14(self):
        p = PALETTES["dark_blue_white"]
        f = FRAME_SIZES["11x14"]
        self.assertEqual(p["bg"], "#0f172a")
        self.assertEqual(p["wave"], "#ffffff")
        self.assertEqual(f["price_cents"], 6900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-11X14")

    # 11. Dark Blue / White × 16x20
    def test_permutation_dark_blue_white_16x20(self):
        p = PALETTES["dark_blue_white"]
        f = FRAME_SIZES["16x20"]
        self.assertEqual(p["bg"], "#0f172a")
        self.assertEqual(p["wave"], "#ffffff")
        self.assertEqual(f["price_cents"], 9900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-16X20")

    # 12. Dark Blue / White × 24x36
    def test_permutation_dark_blue_white_24x36(self):
        p = PALETTES["dark_blue_white"]
        f = FRAME_SIZES["24x36"]
        self.assertEqual(p["bg"], "#0f172a")
        self.assertEqual(p["wave"], "#ffffff")
        self.assertEqual(f["price_cents"], 14900)
        self.assertEqual(f["prodigi_sku"], "GLOBAL-CFP-24X36")


if __name__ == "__main__":
    unittest.main()
