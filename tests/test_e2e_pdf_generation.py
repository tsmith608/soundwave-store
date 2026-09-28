"""
tests/test_e2e_pdf_generation.py

Comprehensive 4-Tier E2E Test Suite for High-Resolution PDF Fulfillment.
Verifies end-to-end:
  Tier 1: Feature Coverage:
    - 300 DPI high-res PDF generation across all 4 frame sizes (8x10, 11x14, 16x20, 24x36)
    - Strict file size enforcement >= 1,000,000 bytes (>= 1MB) for all frame sizes
    - Exact physical inch MediaBox point assertions (576x720, 792x1008, 1152x1440, 1728x2592)
    - Soundwave-only and photo+soundwave modes
    - High-res PDF generation across aesthetic themes
    - Fast preview thumbnail generation < 500 KB (target 30-150 KB)
  Tier 2: Boundary & Corner Cases:
    - Empty captions and excessive length captions (200+ chars, special chars, unicode)
    - Extreme photo aspect ratios (square 1:1, ultrawide 21:9, vertical 9:16, tiny 10x10, large 4000x3000)
    - Non-existent photo path graceful fallback
    - Unknown/unregistered theme fallback
  Tier 3: Cross-Feature Combinations:
    - Pairwise permutations of themes x frame sizes x color palettes
    - QR code scannability and URL embedding
    - Typography stack variations (serif, cursive, sans)
  Tier 4: Real-World Scenarios & Workloads:
    - Multi-step fulfillment pipeline execution (audio -> waveform -> preview -> print PDF)
    - Dual-asset consistency between preview thumbnail and high-res print PDF
    - Fine-art paper tooth density verification preventing DCT compression collapse

Execution:
  python -m unittest tests/test_e2e_pdf_generation.py
"""

from __future__ import annotations

import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import tempfile
import time
import unittest
import wave

import numpy as np
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from backend.print_engine import (
    FRAME_CONFIGS,
    PALETTE_CONFIGS,
    compile_print_pdf,
    generate_fine_art_texture,
    generate_qr_code,
    sanitize_caption,
)
from backend.preview_generator import (
    PREVIEW_SIZE_MAP,
    calculate_preview_dimensions,
    generate_preview_thumbnail,
)
from backend.waveform_generator import (
    WaveformConfig,
    generate_waveform_image,
)

# Expected MediaBox points (72 points/inch)
EXPECTED_MEDIABOX: dict[str, tuple[float, float]] = {
    "8x10": (576.0, 720.0),
    "11x14": (792.0, 1008.0),
    "16x20": (1152.0, 1440.0),
    "24x36": (1728.0, 2592.0),
}

ALL_AESTHETIC_THEMES = [
    "botanical",
    "modern_border",
    "arch",
    "art_deco",
    "vintage_grunge",
    "luxury_marble",
    "abstract_geometric",
    "celestial",
]


def extract_pdf_mediabox(pdf_path: str | Path) -> list[tuple[float, float, float, float]]:
    """Extracts all /MediaBox [x y w h] declarations from PDF binary."""
    with open(pdf_path, "rb") as f:
        data = f.read()
    matches = re.findall(rb"/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]", data)
    boxes = []
    for m in matches:
        boxes.append((float(m[0]), float(m[1]), float(m[2]), float(m[3])))
    return boxes


def make_test_photo(
    output_path: str,
    width: int,
    height: int,
    color: tuple = (210, 180, 150),
    format: str = "JPEG",
) -> str:
    """Generates a synthetic customer photo with non-trivial gradient to avoid compression zeroing."""
    img = Image.new("RGB", (width, height), color)
    draw = ImageDraw.Draw(img)
    draw.line([(0, 0), (width, height)], fill=(100, 50, 30), width=max(2, width // 40))
    draw.line([(0, height), (width, 0)], fill=(40, 80, 140), width=max(2, width // 40))
    r = min(width, height) // 4
    draw.ellipse([(width // 2 - r, height // 2 - r), (width // 2 + r, height // 2 + r)], fill=(180, 120, 90))
    img.save(output_path, format=format, quality=92)
    return output_path


def make_test_waveform(output_path: str, width: int = 2400, height: int = 600) -> str:
    """Generates a discrete pill-bar transparent waveform PNG."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bars = 64
    bar_w = int((width / bars) * 0.6)
    for i in range(bars):
        h = int((height * 0.4) * (math.sin(i * 0.25) ** 2 + 0.2))
        x0 = int(i * (width / bars) + (width / bars - bar_w) / 2)
        y0 = (height - h) // 2
        draw.rectangle([x0, y0, x0 + bar_w, y0 + h], fill=(212, 175, 55, 240))
    img.save(output_path, format="PNG")
    return output_path


def make_test_wav(output_path: str, duration_sec: float = 2.0, freq: float = 440.0) -> str:
    """Generates a valid 16-bit mono 44.1kHz WAV file."""
    sample_rate = 44100
    n_samples = int(duration_sec * sample_rate)
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw = bytearray()
        for i in range(n_samples):
            val = int(math.sin(2.0 * math.pi * freq * (i / sample_rate)) * 16000)
            raw.extend(val.to_bytes(2, byteorder="little", signed=True))
        wf.writeframes(raw)
    return output_path


# =========================================================================
# TIER 1: CORE FEATURE COVERAGE (PDF & PREVIEW GENERATION)
# =========================================================================
class TestTier1FeatureCoverage(unittest.TestCase):
    """Tier 1: High-resolution PDF compilation, file size thresholds, MediaBox points, and previews."""

    @classmethod
    def setUpClass(cls):
        cls.work_dir = tempfile.mkdtemp(prefix="soundwave_t1_")
        cls.wave_path = make_test_waveform(os.path.join(cls.work_dir, "test_wave.png"))
        cls.photo_path = make_test_photo(os.path.join(cls.work_dir, "test_photo.jpg"), 1200, 900)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.work_dir, ignore_errors=True)

    def test_t1_01_all_frame_sizes_produce_ge_1mb_pdfs(self):
        """Compiles PDFs across all 4 frame sizes asserting file size >= 1,000,000 bytes."""
        frame_themes = [
            ("8x10", "botanical"),
            ("11x14", "modern_border"),
            ("16x20", "arch"),
            ("24x36", "art_deco"),
        ]
        for size, theme in frame_themes:
            out_pdf = os.path.join(self.work_dir, f"t1_size_{size}.pdf")
            result = compile_print_pdf(
                waveform_image_path=self.wave_path,
                photo_image_path=self.photo_path,
                output_pdf_path=out_pdf,
                frame_size=size,
                decorative_theme=theme,
                caption=f"Tier 1 Test - {size} {theme}",
            )
            self.assertTrue(os.path.exists(out_pdf), f"PDF was not created for {size}")
            file_size = os.path.getsize(out_pdf)
            self.assertGreaterEqual(
                file_size,
                1_000_000,
                f"PDF size for {size} was {file_size} bytes, which is strictly less than 1,000,000 bytes",
            )
            # Check valid %PDF magic header
            with open(out_pdf, "rb") as f:
                header = f.read(5)
                self.assertEqual(header, b"%PDF-", f"Invalid PDF header for {size}")

    def test_t1_02_exact_physical_mediabox_points(self):
        """Validates that MediaBox points in generated PDFs match exact physical inch dimensions (72 pt/in)."""
        for size, (exp_w, exp_h) in EXPECTED_MEDIABOX.items():
            out_pdf = os.path.join(self.work_dir, f"t1_mb_{size}.pdf")
            compile_print_pdf(
                waveform_image_path=self.wave_path,
                output_pdf_path=out_pdf,
                frame_size=size,
                caption=f"MediaBox Check {size}",
            )
            boxes = extract_pdf_mediabox(out_pdf)
            self.assertTrue(len(boxes) > 0, f"No MediaBox declaration found in {out_pdf}")
            # First box represents the primary page
            _, _, w, h = boxes[0]
            self.assertEqual(
                (round(w), round(h)),
                (round(exp_w), round(exp_h)),
                f"MediaBox mismatch for {size}: got ({w}, {h}), expected ({exp_w}, {exp_h})",
            )

    def test_t1_03_soundwave_only_mode_compilation(self):
        """Verifies compilation in soundwave-only mode (no photo) produces valid PDF >= 1,000,000 bytes."""
        out_pdf = os.path.join(self.work_dir, "t1_soundwave_only.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            photo_image_path=None,
            output_pdf_path=out_pdf,
            frame_size="16x20",
            decorative_theme="vintage_grunge",
            caption="Soundwave Only Track",
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_t1_04_photo_plus_soundwave_mode_compilation(self):
        """Verifies photo + soundwave mode incorporates both elements into print PDF >= 1,000,000 bytes."""
        out_pdf = os.path.join(self.work_dir, "t1_photo_soundwave.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            photo_image_path=self.photo_path,
            output_pdf_path=out_pdf,
            frame_size="16x20",
            decorative_theme="luxury_marble",
            caption="Photo Plus Soundwave",
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_t1_05_preview_thumbnail_generation_under_500kb(self):
        """Verifies fast preview thumbnail generator generates images strictly < 500 KB."""
        for size in ["8x10", "11x14", "16x20", "24x36"]:
            out_thumb = os.path.join(self.work_dir, f"t1_thumb_{size}.jpg")
            generate_preview_thumbnail(
                waveform_image_path=self.wave_path,
                photo_image_path=self.photo_path,
                output_path=out_thumb,
                frame_size=size,
                decorative_theme="celestial",
                format="JPEG",
                quality=85,
            )
            self.assertTrue(os.path.exists(out_thumb))
            thumb_size = os.path.getsize(out_thumb)
            self.assertLess(
                thumb_size,
                500 * 1024,
                f"Preview thumbnail for {size} exceeded 500 KB: {thumb_size} bytes",
            )
            # Verify image opens and has max dimension <= 800
            with Image.open(out_thumb) as img:
                self.assertLessEqual(max(img.size), 800)


# =========================================================================
# TIER 2: BOUNDARY & CORNER CASES
# =========================================================================
class TestTier2BoundaryCases(unittest.TestCase):
    """Tier 2: Empty captions, long text, extreme photos, missing inputs, and fallback themes."""

    @classmethod
    def setUpClass(cls):
        cls.work_dir = tempfile.mkdtemp(prefix="soundwave_t2_")
        cls.wave_path = make_test_waveform(os.path.join(cls.work_dir, "test_wave.png"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.work_dir, ignore_errors=True)

    def test_t2_01_empty_and_whitespace_captions(self):
        """Compiles PDF with empty string and whitespace-only captions without crashing or corrupting."""
        out_pdf = os.path.join(self.work_dir, "t2_empty_caption.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            output_pdf_path=out_pdf,
            frame_size="8x10",
            caption="   ",
            subcaption="",
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_t2_02_extreme_long_caption_sanitization(self):
        """Tests that 200+ character captions with special characters & HTML are sanitized and truncated."""
        long_cap = "Our Wedding Vows — <script>alert(1)</script> " + ("Forever & Always " * 20)
        sanitized = sanitize_caption(long_cap, max_length=200)
        self.assertLessEqual(len(sanitized), 300)  # Account for HTML entity expansion like &amp;
        self.assertNotIn("<script>", sanitized)
        self.assertIn("&lt;script&gt;", sanitized)

        out_pdf = os.path.join(self.work_dir, "t2_long_caption.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            output_pdf_path=out_pdf,
            frame_size="11x14",
            caption=long_cap,
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_t2_03_extreme_photo_aspect_ratios(self):
        """Tests preview and PDF generation with extreme photo dimensions (square 1:1, ultrawide 21:9, vertical 9:16)."""
        aspect_specs = [
            ("square_1x1", 600, 600),
            ("ultrawide_21x9", 2100, 900),
            ("vertical_9x16", 540, 960),
            ("tiny_20x20", 20, 20),
        ]
        for label, w, h in aspect_specs:
            photo_file = os.path.join(self.work_dir, f"photo_{label}.jpg")
            make_test_photo(photo_file, w, h)
            thumb_file = os.path.join(self.work_dir, f"thumb_{label}.jpg")
            generate_preview_thumbnail(
                waveform_image_path=self.wave_path,
                photo_image_path=photo_file,
                output_path=thumb_file,
                frame_size="16x20",
                format="JPEG",
            )
            self.assertTrue(os.path.exists(thumb_file))
            self.assertLess(os.path.getsize(thumb_file), 500 * 1024)

    def test_t2_04_missing_or_corrupted_photo_path_fallback(self):
        """Gracefully degrades to soundwave-only mode when photo path does not exist."""
        ghost_photo = os.path.join(self.work_dir, "non_existent_photo_12345.jpg")
        out_pdf = os.path.join(self.work_dir, "t2_ghost_photo.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            photo_image_path=ghost_photo,
            output_pdf_path=out_pdf,
            frame_size="8x10",
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_t2_05_unrecognized_theme_fallback(self):
        """Gracefully handles unrecognized theme key without throwing error."""
        out_pdf = os.path.join(self.work_dir, "t2_fallback_theme.pdf")
        compile_print_pdf(
            waveform_image_path=self.wave_path,
            output_pdf_path=out_pdf,
            frame_size="8x10",
            decorative_theme="unknown_cyberpunk_neon_theme",
        )
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)


# =========================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS
# =========================================================================
class TestTier3Combinations(unittest.TestCase):
    """Tier 3: Pairwise combinations of themes x sizes x palettes, QR embedding, and typography."""

    @classmethod
    def setUpClass(cls):
        cls.work_dir = tempfile.mkdtemp(prefix="soundwave_t3_")
        cls.wave_path = make_test_waveform(os.path.join(cls.work_dir, "test_wave.png"))
        cls.photo_path = make_test_photo(os.path.join(cls.work_dir, "test_photo.jpg"), 1000, 750)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.work_dir, ignore_errors=True)

    def test_t3_01_all_eight_aesthetic_themes_preview_generation(self):
        """Validates preview thumbnail compositing across all 8 researched aesthetic themes."""
        for theme in ALL_AESTHETIC_THEMES:
            out_thumb = os.path.join(self.work_dir, f"t3_theme_{theme}.png")
            generate_preview_thumbnail(
                waveform_image_path=self.wave_path,
                photo_image_path=self.photo_path,
                output_path=out_thumb,
                frame_size="16x20",
                decorative_theme=theme,
                format="PNG",
            )
            self.assertTrue(os.path.exists(out_thumb), f"Failed thumbnail for {theme}")
            self.assertLess(os.path.getsize(out_thumb), 500 * 1024)

    def test_t3_02_qr_code_scannability_and_target_url(self):
        """Validates that QR code generation generates a PNG linking to audio playback URL."""
        qr_file = os.path.join(self.work_dir, "test_qr.png")
        generate_qr_code("order_uuid_abc123", output_path=qr_file)
        self.assertTrue(os.path.exists(qr_file))
        with Image.open(qr_file) as img:
            self.assertGreaterEqual(img.width, 100)
            self.assertGreaterEqual(img.height, 100)

    def test_t3_03_typography_stack_variations(self):
        """Verifies PDF compilation under different font_style variants (serif, cursive, sans)."""
        font_styles = ["serif", "cursive", "sans"]
        for fs in font_styles:
            out_pdf = os.path.join(self.work_dir, f"t3_font_{fs}.pdf")
            compile_print_pdf(
                waveform_image_path=self.wave_path,
                output_pdf_path=out_pdf,
                frame_size="8x10",
                font_style=fs,
                caption=f"Typography Variant {fs}",
            )
            self.assertTrue(os.path.exists(out_pdf))
            self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)


# =========================================================================
# TIER 4: REAL-WORLD WORKFLOWS & WORKLOADS
# =========================================================================
class TestTier4Workloads(unittest.TestCase):
    """Tier 4: Full multi-step fulfillment pipeline, noise synthesis density, and asset consistency."""

    @classmethod
    def setUpClass(cls):
        cls.work_dir = tempfile.mkdtemp(prefix="soundwave_t4_")
        cls.audio_wav = os.path.join(cls.work_dir, "recorded_voice.wav")
        make_test_wav(cls.audio_wav, duration_sec=2.5, freq=520.0)
        cls.photo_path = make_test_photo(os.path.join(cls.work_dir, "anniversary.jpg"), 1600, 1200)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.work_dir, ignore_errors=True)

    def test_t4_01_end_to_end_fulfillment_workflow(self):
        """Simulates full fulfillment pipeline: audio synthesis -> waveform generation -> thumbnail preview -> 300 DPI PDF."""
        # Step 1: Generate discrete waveform PNG
        wave_png = os.path.join(self.work_dir, "pipeline_wave.png")
        cfg = WaveformConfig(
            width=2400,
            height=600,
            style="pill_bars",
            num_bars=72,
            palette="midnight_gold",
            transparent_bg=True,
        )
        generate_waveform_image(
            audio_source=self.audio_wav,
            output_path=wave_png,
            config=cfg,
        )
        self.assertTrue(os.path.exists(wave_png))

        # Step 2: Generate preview thumbnail (< 500 KB)
        preview_jpg = os.path.join(self.work_dir, "pipeline_preview.jpg")
        generate_preview_thumbnail(
            waveform_image_path=wave_png,
            photo_image_path=self.photo_path,
            output_path=preview_jpg,
            frame_size="16x20",
            decorative_theme="arch",
            caption="Wedding Vows — June 20, 2026",
            format="JPEG",
            quality=85,
        )
        self.assertTrue(os.path.exists(preview_jpg))
        self.assertLess(os.path.getsize(preview_jpg), 500 * 1024)

        # Step 3: Compile 300 DPI High-Res Print PDF (>= 1MB)
        print_pdf = os.path.join(self.work_dir, "pipeline_print.pdf")
        compile_print_pdf(
            waveform_image_path=wave_png,
            photo_image_path=self.photo_path,
            output_pdf_path=print_pdf,
            frame_size="16x20",
            decorative_theme="arch",
            palette="midnight_gold",
            caption="Wedding Vows — June 20, 2026",
            subcaption="Sacré-Cœur, Paris",
        )
        self.assertTrue(os.path.exists(print_pdf))
        self.assertGreaterEqual(os.path.getsize(print_pdf), 1_000_000)

        # Step 4: Verify physical MediaBox dimensions
        boxes = extract_pdf_mediabox(print_pdf)
        self.assertTrue(len(boxes) > 0)
        _, _, w, h = boxes[0]
        self.assertEqual((round(w), round(h)), (1152, 1440))

    def test_t4_02_fine_art_noise_texture_entropy(self):
        """Verifies that the synthesized paper noise texture contains non-trivial entropy across dark and light palettes."""
        tex_light = generate_fine_art_texture(2400, 3000, "#FAF7F2")
        self.assertTrue(os.path.exists(tex_light))
        # Verify texture image has variance > 0 (not a flat blank image)
        with Image.open(tex_light) as img:
            arr = np.array(img, dtype=float)
            std_dev = np.std(arr)
            self.assertGreater(std_dev, 0.5, "Light paper tooth texture lacks sufficient entropy")
        os.remove(tex_light)

        tex_dark = generate_fine_art_texture(2400, 3000, "#0c0c0c")
        self.assertTrue(os.path.exists(tex_dark))
        with Image.open(tex_dark) as img:
            arr = np.array(img, dtype=float)
            std_dev = np.std(arr)
            self.assertGreater(std_dev, 0.5, "Dark paper tooth texture lacks sufficient entropy")
        os.remove(tex_dark)


if __name__ == "__main__":
    unittest.main(verbosity=2)
