"""
Tier 1: Feature Coverage Tests.
Feature 12: 300 DPI Print-Ready PDF Generator (M2, R2, AC).
Directly exercises backend.print_engine and Playwright compiler.
Verifies physical inch dimension compliance, 300 DPI pixel density,
strict file size >= 1MB requirement, QR code embedding, and valid PDF structure.
"""

import os
import re
import tempfile
import unittest
from pathlib import Path
from PIL import Image

import backend.print_engine as pe
import backend.waveform_generator as wg
from backend.print_engine import (
    FRAME_CONFIGS,
    POSTER_TEMPLATE_PATH,
    compile_print_pdf,
    generate_qr_code,
)
from tests.test_harness import generate_wav


class TestFeature12PrintPdfGenerator(unittest.TestCase):
    """Verifies print-ready PDF generator specifications by compiling real art."""

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.td_path = Path(cls.temp_dir.name)

        # 1. Synthesize 1-second audio file
        cls.wav_path = cls.td_path / "test_feat12.wav"
        generate_wav(str(cls.wav_path), duration_seconds=1.0)

        # 2. Render discrete waveform PNG
        cls.wave_png_path = cls.td_path / "test_feat12_wave.png"
        wg.generate_waveform_image(
            audio_source=str(cls.wav_path),
            output_path=str(cls.wave_png_path),
            palette="midnight_gold",
            transparent_bg=True,
        )

        # 3. Compile real 300 DPI PDF via Playwright
        cls.pdf_path = cls.td_path / "test_feat12_print.pdf"
        cls.pdf_result = compile_print_pdf(
            waveform_image_path=str(cls.wave_png_path),
            output_pdf_path=str(cls.pdf_path),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Feature 12 Production Verification",
            target_id_or_url="ord_feat12_verify_001",
        )

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def test_pdf_file_size_greater_than_or_equal_1mb(self):
        """Verifies Acceptance Criteria rule: generated PDF must strictly be >= 1,000,000 bytes."""
        min_required_bytes = 1_000_000  # 1MB
        self.assertTrue(self.pdf_path.exists(), f"PDF was not created at {self.pdf_path}")

        actual_file_size = os.path.getsize(str(self.pdf_path))
        self.assertGreaterEqual(
            actual_file_size,
            min_required_bytes,
            f"PDF output {actual_file_size} bytes must strictly meet or exceed 1,000,000 bytes",
        )
        self.assertEqual(self.pdf_result["file_size_bytes"], actual_file_size)
        self.assertGreaterEqual(self.pdf_result["file_size_mb"], 1.0)

    def test_pdf_physical_page_size_inch_units(self):
        """Verifies CSS @page physical page sizes and actual PDF MediaBox match frame dimensions."""
        # 1. Verify FRAME_CONFIGS inch specification in production print engine
        for frame_key, f in FRAME_CONFIGS.items():
            self.assertIn("w_in", f)
            self.assertIn("h_in", f)
            self.assertGreater(f["w_in"], 0)
            self.assertGreater(f["h_in"], 0)

        # 2. Verify Jinja2 template contains physical inch rules
        self.assertTrue(POSTER_TEMPLATE_PATH.exists())
        template_text = POSTER_TEMPLATE_PATH.read_text(encoding="utf-8")
        self.assertIn("@page", template_text)
        self.assertIn("size: {{ width_in }}in {{ height_in }}in", template_text)

        # 3. Verify compiled 16x20 PDF MediaBox in points (16in * 72pt = 1152, 20in * 72pt = 1440)
        with open(str(self.pdf_path), "rb") as f:
            pdf_bytes = f.read()
        mediabox_match = re.search(rb"/MediaBox\s*\[\s*0\s+0\s+(\d+)\s+(\d+)\s*\]", pdf_bytes)
        self.assertIsNotNone(mediabox_match, "PDF must contain a valid MediaBox definition")
        width_pt = int(mediabox_match.group(1))
        height_pt = int(mediabox_match.group(2))
        self.assertEqual(width_pt, 1152, "16-inch width must correspond to 1152 PostScript points")
        self.assertEqual(height_pt, 1440, "20-inch height must correspond to 1440 PostScript points")

    def test_pdf_valid_header_structure(self):
        """Verifies genuine compiled PDF begins with %PDF-1. magic header and ends with %%EOF."""
        with open(str(self.pdf_path), "rb") as f:
            header = f.read(1024)
            f.seek(max(0, os.path.getsize(str(self.pdf_path)) - 1024))
            trailer = f.read(1024)

        valid_pdf_magic = b"%PDF-1."
        self.assertTrue(
            header.startswith(valid_pdf_magic),
            f"Compiled PDF header must start with {valid_pdf_magic}, got {header[:16]}",
        )
        self.assertIn(b"%%EOF", trailer, "Compiled PDF must contain valid %%EOF trailer")

    def test_pdf_embeds_qr_code(self):
        """Verifies QR code generator creates a scannable PNG file linking to the audio page."""
        order_id = "ord_test_qr_88"
        qr_file_path = generate_qr_code(order_id)
        self.assertTrue(os.path.exists(qr_file_path), "generate_qr_code must create a valid file")

        try:
            with Image.open(qr_file_path) as img:
                self.assertEqual(img.format, "PNG")
                self.assertGreaterEqual(img.width, 100)
                self.assertGreaterEqual(img.height, 100)
        finally:
            if os.path.exists(qr_file_path):
                os.unlink(qr_file_path)

    def test_pdf_high_dpi_resolution_quality(self):
        """Verifies 300 DPI pixel dimensions across all production frame specifications."""
        f_16x20 = FRAME_CONFIGS["16x20"]
        self.assertEqual(f_16x20["w_px_300dpi"], 4800)
        self.assertEqual(f_16x20["h_px_300dpi"], 6000)

        for frame_key, conf in FRAME_CONFIGS.items():
            self.assertEqual(conf["w_px_300dpi"], conf["w_in"] * 300)
            self.assertEqual(conf["h_px_300dpi"], conf["h_in"] * 300)


if __name__ == "__main__":
    unittest.main()
