"""
Tier 1: Feature Coverage Tests.
Feature 13: Low-Res Preview Generator (M2, R3, AC).
Tests 800px preview image resolution, PNG/JPEG format compliance,
aspect ratio fidelity, and web delivery optimization via backend.preview_generator.
"""

import os
import tempfile
import unittest
from pathlib import Path
from PIL import Image

from backend.preview_generator import (
    PREVIEW_SIZE_MAP,
    calculate_preview_dimensions,
    generate_preview_thumbnail,
)
import backend.waveform_generator as wg
from tests.test_harness import FRAME_SIZES, generate_wav


class TestFeature13PreviewThumbnail(unittest.TestCase):
    """Verifies low-resolution preview thumbnail generation using production backend module."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.td = Path(self.temp_dir.name)

        # Generate sample audio & waveform
        self.wav_path = self.td / "sample.wav"
        generate_wav(str(self.wav_path), duration_seconds=1.0)
        self.wave_path = self.td / "wave.png"
        wg.generate_waveform_image(
            audio_source=str(self.wav_path),
            output_path=str(self.wave_path),
            palette="midnight_gold",
            transparent_bg=True,
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_preview_image_max_dimension_800px(self):
        """Verifies max dimension of preview thumbnail does not exceed 800px."""
        max_dim = 800
        for frame_key in FRAME_SIZES:
            preview_w, preview_h = calculate_preview_dimensions(frame_key, max_dim=max_dim)
            self.assertLessEqual(preview_w, max_dim)
            self.assertLessEqual(preview_h, max_dim)
            self.assertEqual(max(preview_w, preview_h), max_dim)

    def test_preview_image_aspect_ratio_match(self):
        """Verifies preview thumbnail retains physical frame aspect ratio."""
        for frame_key, f in FRAME_SIZES.items():
            expected_ratio = f["w_in"] / f["h_in"]
            preview_w, preview_h = calculate_preview_dimensions(frame_key, max_dim=800)
            actual_ratio = preview_w / preview_h
            self.assertAlmostEqual(actual_ratio, expected_ratio, places=2)

    def test_preview_image_format_validity(self):
        """Verifies preview output creates a valid PNG image."""
        out_img_path = self.td / "preview_test.png"
        generate_preview_thumbnail(
            output_path=str(out_img_path),
            waveform_image_path=str(self.wave_path),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Test Caption",
            format="PNG",
        )
        self.assertTrue(out_img_path.exists())
        with Image.open(out_img_path) as img:
            self.assertEqual(img.format, "PNG")
            self.assertEqual(img.size, (640, 800))

    def test_preview_file_size_optimized(self):
        """Verifies real preview image is lightweight (< 500 KB) for fast status page loading."""
        out_img_path = self.td / "preview_size_test.png"
        generate_preview_thumbnail(
            output_path=str(out_img_path),
            waveform_image_path=str(self.wave_path),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Size Verification",
            format="PNG",
        )
        self.assertTrue(out_img_path.exists())
        actual_size = os.path.getsize(str(out_img_path))
        max_allowed_preview_bytes = 500_000

        self.assertGreater(actual_size, 1_000, "Preview image must not be empty")
        self.assertLess(
            actual_size,
            max_allowed_preview_bytes,
            f"Preview size {actual_size} bytes must be under 500 KB",
        )

    def test_preview_image_palette_consistency(self):
        """Verifies preview generator accepts palette configuration and sets background correctly."""
        out_img_path = self.td / "preview_white.png"
        generate_preview_thumbnail(
            output_path=str(out_img_path),
            waveform_image_path=str(self.wave_path),
            frame_size="8x10",
            palette="white_silver",
            caption="White Silver Test",
            format="PNG",
        )
        self.assertTrue(out_img_path.exists())
        with Image.open(out_img_path) as img:
            # Check corner pixel matches white background
            corner_pixel = img.getpixel((0, 0))
            self.assertEqual(corner_pixel, (255, 255, 255))


if __name__ == "__main__":
    unittest.main()
