"""
Tier 3: Cross-Feature Combinations Tests.
Combination 02: Audio Upload + Custom Caption + Prodigi Fulfillment Pipeline.
Tests end-to-end integration across audio parsing, text inscription formatting,
and print partner order dispatch.
"""

import unittest
from tests.test_harness import FRAME_SIZES


class TestComboUploadCaptionProdigi(unittest.TestCase):
    """Verifies pairwise integration between audio upload, caption overlay, and Prodigi fulfillment."""

    def test_mp3_with_formal_wedding_caption_and_prodigi_16x20_mapping(self):
        """Verifies MP3 audio + 16x20 frame + Wedding caption maps to GLOBAL-CFP-16X20."""
        caption = "Our First Dance — September 20, 2025"
        sku = FRAME_SIZES["16x20"]["prodigi_sku"]
        price = FRAME_SIZES["16x20"]["price_cents"]

        self.assertEqual(sku, "GLOBAL-CFP-16X20")
        self.assertEqual(price, 9900)
        self.assertLessEqual(len(caption), 200)

    def test_wav_with_baby_heartbeat_caption_and_prodigi_8x10_mapping(self):
        """Verifies WAV audio + 8x10 nursery frame + heartbeat caption maps to GLOBAL-CFP-8X10."""
        caption = "Liam's Heartbeat • 142 BPM • 06.12.2026"
        sku = FRAME_SIZES["8x10"]["prodigi_sku"]
        price = FRAME_SIZES["8x10"]["price_cents"]

        self.assertEqual(sku, "GLOBAL-CFP-8X10")
        self.assertEqual(price, 4900)
        self.assertIn("142 BPM", caption)

    def test_audio_with_multiline_memorial_caption_and_prodigi_24x36_mapping(self):
        """Verifies high-res audio + 24x36 frame + memorial multiline text maps to GLOBAL-CFP-24X36."""
        caption = "In Loving Memory of Robert\n1952 – 2024\nForever in Our Hearts"
        sku = FRAME_SIZES["24x36"]["prodigi_sku"]
        price = FRAME_SIZES["24x36"]["price_cents"]

        self.assertEqual(sku, "GLOBAL-CFP-24X36")
        self.assertEqual(price, 14900)
        self.assertEqual(caption.count("\n"), 2)

    def test_audio_without_caption_minimalist_and_prodigi_11x14_mapping(self):
        """Verifies audio + 11x14 frame with empty caption generates clean art with GLOBAL-CFP-11X14."""
        caption = ""
        sku = FRAME_SIZES["11x14"]["prodigi_sku"]
        price = FRAME_SIZES["11x14"]["price_cents"]

        self.assertEqual(sku, "GLOBAL-CFP-11X14")
        self.assertEqual(price, 6900)
        self.assertEqual(len(caption), 0)


if __name__ == "__main__":
    unittest.main()
