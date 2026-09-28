"""
tests/test_gen5_pdf_fulfillment_adversarial.py
Adversarial Empirical Stress Testing Suite for SoundWave Art Generation 5
Focus: Python PDF Generation & Fulfillment Pipeline with Audio Waveform and Photo Upload

Tests:
  a) compile_print_pdf with both audio waveform and photo (JPEG, PNG).
  b) different photo dimensions and aspect ratios (portrait 3:4, square 1:1, landscape 16:9, very small 10x10, large 4000x3000).
  c) decorative themes (botanical, modern_border, arch, minimal).
  d) all physical frame sizes (8x10, 11x14, 16x20, 24x36).
  e) verify PDF file size >= 1,000,000 bytes, valid %PDF header, correct MediaBox points.
  f) preview_generator thumbnail size < 500 KB across all variations.
  g) fulfill.py execution with photo_path in order details (API & CLI).
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import wave

import numpy as np
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import email_service, preview_generator, print_engine, print_partner, waveform_generator
from backend.fulfill import PIPELINE_STEPS, run_fulfillment
from backend.preview_generator import generate_preview_thumbnail
from backend.print_engine import FRAME_CONFIGS, PALETTE_CONFIGS, compile_print_pdf


# Expected MediaBox points (72 points per inch): width = w_in * 72, height = h_in * 72
EXPECTED_MEDIABOX = {
    "8x10": (576, 720),
    "11x14": (792, 1008),
    "16x20": (1152, 1440),
    "24x36": (1728, 2592),
}


def parse_pdf_mediabox_full(pdf_path: str) -> list[tuple[float, float, float, float]]:
    """Scans the entire PDF binary to extract all /MediaBox [x y w h] declarations."""
    with open(pdf_path, "rb") as f:
        data = f.read()
    # Match /MediaBox [ 0 0 576 720 ] with optional floating points
    matches = re.findall(rb"/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]", data)
    boxes = []
    for m in matches:
        boxes.append((float(m[0]), float(m[1]), float(m[2]), float(m[3])))
    return boxes


def create_test_photo(
    output_path: str,
    width: int,
    height: int,
    format: str = "JPEG",
    mode: str = "RGB",
    color: tuple = (220, 180, 160),
) -> str:
    """Generates a synthetic photo image with geometric patterns to avoid compression flatlining."""
    img = Image.new(mode, (width, height), color)
    draw = ImageDraw.Draw(img)
    # Add diagonal lines and circles
    draw.line([(0, 0), (width, height)], fill=(120, 60, 40) if mode == "RGB" else 128, width=max(1, width // 50))
    draw.line([(0, height), (width, 0)], fill=(60, 120, 180) if mode == "RGB" else 80, width=max(1, width // 50))
    radius = min(width, height) // 4
    cx, cy = width // 2, height // 2
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=(200, 50, 50) if mode == "RGB" else 200, width=max(1, width // 100))

    if format.upper() in ["JPEG", "JPG"]:
        if mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(output_path, format="JPEG", quality=90)
    else:
        img.save(output_path, format="PNG")
    return output_path


def create_test_waveform(output_path: str, width: int = 2400, height: int = 600) -> str:
    """Creates a discrete transparent pill-bar waveform PNG for testing."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    num_bars = 64
    unit = width / num_bars
    bar_w = max(4, int(unit * 0.65))
    mid_y = height // 2
    for i in range(num_bars):
        sin_val = abs(np.sin(i * 0.2) * np.cos(i * 0.1)) * 0.8 + 0.15
        bh = max(10, int((height * 0.44) * sin_val))
        bx = int(i * unit + (unit - bar_w) / 2)
        draw.rounded_rectangle([bx, mid_y - bh, bx + bar_w, mid_y + bh], radius=bar_w // 2, fill=(212, 175, 55, 255))
    img.save(output_path, format="PNG")
    return output_path


class TestGen5PdfEngineAdversarial(unittest.TestCase):
    """Adversarial testing of compile_print_pdf with photos, dimensions, themes, and frame sizes."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        cls.td = Path(cls.tmp_dir.name)
        cls.wave_png = str(cls.td / "test_waveform.png")
        create_test_waveform(cls.wave_png)

    @classmethod
    def tearDownClass(cls):
        cls.tmp_dir.cleanup()

    # --------------------------------------------------------------------------
    # Requirement a: compile_print_pdf with both audio waveform and photo (JPEG, PNG)
    # --------------------------------------------------------------------------
    def test_a1_compile_with_waveform_and_jpeg_photo(self):
        photo_jpg = str(self.td / "photo_standard.jpg")
        create_test_photo(photo_jpg, 1200, 900, format="JPEG")
        out_pdf = str(self.td / "out_photo_jpeg.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo_jpg,
            frame_size="16x20",
            palette="botanical_sage",
            caption="Wedding Day — June 12, 2025",
            target_id_or_url="ord_test_jpeg",
        )

        self.assertTrue(res["success"])
        self.assertTrue(os.path.exists(out_pdf))
        size = os.path.getsize(out_pdf)
        self.assertGreaterEqual(size, 1_000_000, f"PDF size {size} bytes is strictly under 1MB requirement")
        with open(out_pdf, "rb") as f:
            header = f.read(10)
        self.assertTrue(header.startswith(b"%PDF-"), f"Invalid PDF header: {header}")

    def test_a2_compile_with_waveform_and_png_photo_rgba(self):
        photo_png = str(self.td / "photo_rgba.png")
        create_test_photo(photo_png, 1000, 1000, format="PNG", mode="RGBA")
        out_pdf = str(self.td / "out_photo_png.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo_png,
            frame_size="16x20",
            palette="blush_rose",
            caption="First Ultrasound — Sarah & Jack",
            target_id_or_url="ord_test_png",
        )

        self.assertTrue(res["success"])
        self.assertTrue(os.path.exists(out_pdf))
        size = os.path.getsize(out_pdf)
        self.assertGreaterEqual(size, 1_000_000, f"PDF size {size} bytes is strictly under 1MB requirement")
        with open(out_pdf, "rb") as f:
            header = f.read(10)
        self.assertTrue(header.startswith(b"%PDF-"), f"Invalid PDF header: {header}")

    # --------------------------------------------------------------------------
    # Requirement b: Different photo dimensions and aspect ratios
    # --------------------------------------------------------------------------
    def test_b1_aspect_ratio_portrait_3_4(self):
        photo = str(self.td / "photo_portrait_3_4.jpg")
        create_test_photo(photo, 1500, 2000, format="JPEG")
        out_pdf = str(self.td / "out_ar_3_4.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo,
            frame_size="11x14",
            palette="champagne_gold",
            caption="Portrait 3:4 Aspect Ratio",
        )
        self.assertTrue(res["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_b2_aspect_ratio_square_1_1(self):
        photo = str(self.td / "photo_square_1_1.jpg")
        create_test_photo(photo, 1600, 1600, format="JPEG")
        out_pdf = str(self.td / "out_ar_1_1.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo,
            frame_size="8x10",
            palette="midnight_gold",
            caption="Square 1:1 Aspect Ratio",
        )
        self.assertTrue(res["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_b3_aspect_ratio_landscape_16_9(self):
        photo = str(self.td / "photo_landscape_16_9.jpg")
        create_test_photo(photo, 1920, 1080, format="JPEG")
        out_pdf = str(self.td / "out_ar_16_9.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo,
            frame_size="16x20",
            palette="lavender_mist",
            caption="Landscape 16:9 Aspect Ratio",
        )
        self.assertTrue(res["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_b4_dimension_tiny_10x10(self):
        photo = str(self.td / "photo_tiny_10x10.png")
        create_test_photo(photo, 10, 10, format="PNG")
        out_pdf = str(self.td / "out_dim_10x10.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo,
            frame_size="8x10",
            palette="botanical_sage",
            caption="Extreme Boundary: 10x10 Tiny Photo",
        )
        self.assertTrue(res["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_b5_dimension_large_4000x3000(self):
        photo = str(self.td / "photo_large_4000x3000.jpg")
        create_test_photo(photo, 4000, 3000, format="JPEG")
        out_pdf = str(self.td / "out_dim_4000x3000.pdf")

        res = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf,
            photo_image_path=photo,
            frame_size="24x36",
            palette="midnight_gold",
            caption="Extreme Stress: 4000x3000 High-Res Photo",
        )
        self.assertTrue(res["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    # --------------------------------------------------------------------------
    # Requirement c: Decorative themes (all 8 aesthetic styles)
    # --------------------------------------------------------------------------
    def test_c_decorative_themes_execution(self):
        """Tests that compile_print_pdf accepts all 8 decorative themes without crashing."""
        themes = [
            "botanical",
            "modern_border",
            "arch",
            "art_deco",
            "vintage_grunge",
            "luxury_marble",
            "abstract_geometric",
            "celestial",
        ]
        photo = str(self.td / "photo_theme_test.jpg")
        create_test_photo(photo, 800, 600, format="JPEG")

        results = {}
        for theme in themes:
            out_pdf = str(self.td / f"out_theme_{theme}.pdf")
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                output_pdf_path=out_pdf,
                photo_image_path=photo,
                decorative_theme=theme,
                frame_size="8x10",
                palette="botanical_sage",
                caption=f"Theme: {theme}",
            )
            self.assertTrue(res["success"], f"Failed to compile PDF for theme: {theme}")
            self.assertTrue(os.path.exists(out_pdf))
            self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)
            results[theme] = out_pdf

        # Also test soundwave-only mode with decorative themes
        out_pdf_soundwave_only = str(self.td / "out_theme_celestial_soundwave_only.pdf")
        res_sw = compile_print_pdf(
            waveform_image_path=self.wave_png,
            output_pdf_path=out_pdf_soundwave_only,
            photo_image_path=None,
            decorative_theme="celestial",
            frame_size="8x10",
            palette="midnight_gold",
            caption="Celestial Soundwave Only",
        )
        self.assertTrue(res_sw["success"])
        self.assertGreaterEqual(os.path.getsize(out_pdf_soundwave_only), 1_000_000)

        # Empirical inspection: Check whether poster_template.html differentiates decorative_theme
        tpl_path = Path(PROJECT_ROOT) / "backend" / "templates" / "poster_template.html"
        tpl_content = tpl_path.read_text(encoding="utf-8")
        has_theme_branching = "theme == 'botanical'" in tpl_content or "theme == 'celestial'" in tpl_content
        self.assertTrue(has_theme_branching, "poster_template.html should contain decorative theme branching")
        print(f"\n[EMPIRICAL OBSERVATION] poster_template.html has theme branching: {has_theme_branching}")

    # --------------------------------------------------------------------------
    # Requirements d & e: All physical frame sizes & PDF post-conditions
    # --------------------------------------------------------------------------
    def test_d_and_e_all_frame_sizes_and_mediabox_compliance(self):
        """
        Verifies:
          - all 4 physical frame sizes (8x10, 11x14, 16x20, 24x36)
          - file size >= 1,000,000 bytes
          - valid %PDF header
          - correct MediaBox points (72 pt / inch)
        """
        photo = str(self.td / "photo_sizes.jpg")
        create_test_photo(photo, 1000, 800, format="JPEG")

        for frame_size, (expected_w_pt, expected_h_pt) in EXPECTED_MEDIABOX.items():
            out_pdf = str(self.td / f"out_framesize_{frame_size}.pdf")
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                output_pdf_path=out_pdf,
                photo_image_path=photo,
                frame_size=frame_size,
                palette="midnight_gold",
                caption=f"Frame Size Check {frame_size}",
                target_id_or_url=f"ord_size_{frame_size}",
            )

            self.assertTrue(res["success"], f"Compilation failed for frame size {frame_size}")
            self.assertTrue(os.path.exists(out_pdf))

            # 1. File size >= 1,000,000 bytes
            file_size = os.path.getsize(out_pdf)
            self.assertGreaterEqual(
                file_size,
                1_000_000,
                f"Frame size {frame_size} generated PDF with size {file_size} bytes, strictly < 1,000,000 bytes",
            )

            # 2. Valid %PDF header
            with open(out_pdf, "rb") as f:
                head = f.read(1024)
            self.assertTrue(head.startswith(b"%PDF-1."), f"Invalid %PDF header on {frame_size}: {head[:10]}")

            # 3. Correct MediaBox points
            boxes = parse_pdf_mediabox_full(out_pdf)
            self.assertGreater(len(boxes), 0, f"No /MediaBox found anywhere in {frame_size} PDF")

            # Check that at least one MediaBox matches exactly or within 1.0 point
            matched = False
            for bx in boxes:
                _, _, w_pt, h_pt = bx
                if abs(w_pt - expected_w_pt) <= 1.0 and abs(h_pt - expected_h_pt) <= 1.0:
                    matched = True
                    break

            self.assertTrue(
                matched,
                f"Frame size {frame_size}: Expected MediaBox ({expected_w_pt}, {expected_h_pt}), but found boxes: {boxes}",
            )


class TestGen5PreviewGeneratorAdversarial(unittest.TestCase):
    """Adversarial testing of preview_generator thumbnail size < 500 KB across all frame sizes & photos."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        cls.td = Path(cls.tmp_dir.name)
        cls.wave_png = str(cls.td / "preview_wave.png")
        create_test_waveform(cls.wave_png)

    @classmethod
    def tearDownClass(cls):
        cls.tmp_dir.cleanup()

    # --------------------------------------------------------------------------
    # Requirement f: preview_generator thumbnail size < 500 KB
    # --------------------------------------------------------------------------
    def test_f1_preview_thumbnail_size_all_frame_sizes_under_500kb(self):
        """Verifies thumbnail size < 500 KB for all 4 frame sizes with photo."""
        photo = str(self.td / "preview_photo.jpg")
        create_test_photo(photo, 2400, 1800, format="JPEG")

        frame_sizes = ["8x10", "11x14", "16x20", "24x36"]
        for fs in frame_sizes:
            out_img = str(self.td / f"thumb_{fs}.png")
            generate_preview_thumbnail(
                output_path=out_img,
                waveform_image_path=self.wave_png,
                photo_image_path=photo,
                frame_size=fs,
                palette="botanical_sage",
                caption=f"Preview Thumbnail Frame {fs}",
                format="PNG",
            )

            self.assertTrue(os.path.exists(out_img))
            fsize = os.path.getsize(out_img)
            self.assertLess(
                fsize,
                500_000,
                f"Thumbnail for frame {fs} is {fsize} bytes, which violates < 500 KB requirement",
            )
            # Check maximum dimension strictly <= 800px
            with Image.open(out_img) as im:
                self.assertLessEqual(max(im.size), 800, f"Thumbnail max dimension exceeds 800px: {im.size}")

    def test_f2_preview_with_different_photo_aspect_ratios_and_sizes(self):
        """Tests preview generation with 3:4, 1:1, 16:9, tiny 10x10, and huge 4000x3000 photos."""
        test_photos = [
            ("p_3_4", create_test_photo(str(self.td / "p_3_4.jpg"), 1500, 2000)),
            ("p_1_1", create_test_photo(str(self.td / "p_1_1.jpg"), 1200, 1200)),
            ("p_16_9", create_test_photo(str(self.td / "p_16_9.jpg"), 1920, 1080)),
            ("p_10x10", create_test_photo(str(self.td / "p_10x10.png"), 10, 10, format="PNG")),
            ("p_4000x3000", create_test_photo(str(self.td / "p_4000x3000.jpg"), 4000, 3000)),
        ]

        for label, p_path in test_photos:
            out_thumb = str(self.td / f"thumb_ar_{label}.png")
            generate_preview_thumbnail(
                output_path=out_thumb,
                waveform_image_path=self.wave_png,
                photo_image_path=p_path,
                frame_size="16x20",
                palette="blush_rose",
                caption=f"Photo Aspect Ratio {label}",
            )
            self.assertTrue(os.path.exists(out_thumb))
            fsize = os.path.getsize(out_thumb)
            self.assertLess(fsize, 500_000, f"Thumbnail {label} exceeded 500 KB: {fsize} bytes")

    def test_f3_preview_decorative_themes_investigation(self):
        """Verifies preview thumbnail generation across all 8 decorative themes for both photo & soundwave-only."""
        photo = str(self.td / "preview_theme_photo.jpg")
        create_test_photo(photo, 1000, 800)

        themes = [
            "botanical",
            "modern_border",
            "arch",
            "art_deco",
            "vintage_grunge",
            "luxury_marble",
            "abstract_geometric",
            "celestial",
        ]
        outputs = {}
        for th in themes:
            out_th = str(self.td / f"thumb_theme_{th}.png")
            generate_preview_thumbnail(
                output_path=out_th,
                waveform_image_path=self.wave_png,
                photo_image_path=photo,
                decorative_theme=th,
                frame_size="16x20",
                palette="champagne_gold",
                caption="Common Caption For Pixel Difference Test",
            )
            self.assertTrue(os.path.exists(out_th))
            fsize = os.path.getsize(out_th)
            self.assertLess(fsize, 500_000, f"Preview for theme {th} exceeded 500 KB: {fsize} bytes")
            with open(out_th, "rb") as f:
                outputs[th] = f.read()

        # Check visual differentiation between distinct themes
        self.assertNotEqual(outputs["botanical"], outputs["modern_border"])
        self.assertNotEqual(outputs["arch"], outputs["art_deco"])
        self.assertNotEqual(outputs["celestial"], outputs["vintage_grunge"])

        # Also verify soundwave-only thumbnail generation with decorative theme
        out_sw = str(self.td / "thumb_soundwave_only_celestial.png")
        generate_preview_thumbnail(
            output_path=out_sw,
            waveform_image_path=self.wave_png,
            photo_image_path=None,
            decorative_theme="celestial",
            frame_size="16x20",
            palette="midnight_gold",
            caption="Celestial Soundwave Only Preview",
        )
        self.assertTrue(os.path.exists(out_sw))
        self.assertLess(os.path.getsize(out_sw), 500_000)


class TestGen5FulfillmentPipelineAdversarial(unittest.TestCase):
    """Adversarial testing of fulfill.py with photo_path in order details (API & CLI)."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.td = Path(self.tmp_dir.name)
        self.db_path = self.td / "test_fulfillment_gen5.db"

        # Initialize SQLite DB schema matching Prisma schema (including photoPath and decorativeTheme)
        conn = sqlite3.connect(str(self.db_path))
        conn.executescript("""
        CREATE TABLE "Order" (
            id TEXT PRIMARY KEY,
            customerEmail TEXT NOT NULL,
            shippingName TEXT,
            shippingAddress TEXT,
            frameSize TEXT NOT NULL,
            palette TEXT NOT NULL,
            decorativeTheme TEXT DEFAULT 'botanical',
            caption TEXT,
            audioPath TEXT NOT NULL,
            photoPath TEXT,
            previewUrl TEXT,
            printPdfPath TEXT,
            status TEXT NOT NULL DEFAULT 'pending_payment',
            partnerOrderId TEXT,
            stripeSessionId TEXT UNIQUE,
            totalAmount INTEGER DEFAULT 0,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
        );

        CREATE TABLE "FulfillmentLog" (
            id TEXT PRIMARY KEY,
            orderId TEXT NOT NULL,
            step TEXT NOT NULL,
            status TEXT NOT NULL,
            details TEXT,
            timestamp INTEGER NOT NULL
        );
        """)

        # Synthesize audio wave and photo
        self.audio_wav = str(self.td / "order_audio.wav")
        # generate a small valid wav file
        with wave.open(self.audio_wav, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            data = (np.sin(2 * np.pi * 440 * np.linspace(0, 1, 44100)) * 32767).astype(np.int16)
            wf.writeframes(data.tobytes())

        self.photo_path = str(self.td / "customer_portrait.jpg")
        create_test_photo(self.photo_path, 1600, 1200, format="JPEG")

        # Seed test order with photoPath and decorativeTheme
        self.order_id = "ord_gen5_adv_test_001"
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, decorativeTheme, caption, audioPath, photoPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                self.order_id,
                "emily.clark@example.com",
                "Emily Clark",
                "123 Millennial Way, Austin, TX 78701",
                "16x20",
                "botanical_sage",
                "botanical",
                "Our Vows in the Hill Country — May 2025",
                self.audio_wav,
                self.photo_path,
                "pending_fulfillment",
                12900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

        print_partner.MockFulfillmentProvider.clear()
        email_service.MockEmailService.clear_sent_emails()

    def tearDown(self):
        self.tmp_dir.cleanup()

    # --------------------------------------------------------------------------
    # Requirement g: fulfill.py execution with photo_path in order details
    # --------------------------------------------------------------------------
    def test_g1_fulfill_python_api_execution_with_photo(self):
        """Verifies run_fulfillment executes all 8 steps with photo_path present."""
        summary = run_fulfillment(
            order_id=self.order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )

        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")
        self.assertTrue(summary["partnerOrderId"].startswith("ord_prodigi_mock_"))
        self.assertGreaterEqual(summary["pdfSizeBytes"], 1_000_000)
        self.assertEqual(summary["steps"], PIPELINE_STEPS)

        # Verify DB status updated
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT * FROM "Order" WHERE id = ?', (self.order_id,))
        row = dict(cur.fetchone())
        self.assertEqual(row["status"], "fulfillment_submitted")
        self.assertEqual(row["partnerOrderId"], summary["partnerOrderId"])
        self.assertIsNotNone(row["printPdfPath"])
        self.assertIsNotNone(row["previewUrl"])

        # Check all 8 steps logged in FulfillmentLog
        cur.execute('SELECT step FROM "FulfillmentLog" WHERE orderId = ?', (self.order_id,))
        logged_steps = [r[0] for r in cur.fetchall()]
        conn.close()
        for step in PIPELINE_STEPS:
            self.assertIn(step, logged_steps, f"Step '{step}' was not recorded in FulfillmentLog")

        # Verify generated PDF on disk
        pdf_file = PROJECT_ROOT / row["printPdfPath"]
        self.assertTrue(pdf_file.exists(), f"Print PDF does not exist at {pdf_file}")
        self.assertGreaterEqual(os.path.getsize(pdf_file), 1_000_000)

    def test_g2_fulfill_cli_execution_with_photo_override_flag(self):
        """Verifies CLI execution: python -m backend.fulfill --order-id <ID> --photo <path>."""
        override_photo = str(self.td / "override_photo.png")
        create_test_photo(override_photo, 800, 800, format="PNG")

        cmd = [
            sys.executable,
            "-m",
            "backend.fulfill",
            "--order-id",
            self.order_id,
            "--provider",
            "mock",
            "--email-provider",
            "mock",
            "--db",
            str(self.db_path),
            "--photo",
            override_photo,
        ]

        proc = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )

        self.assertEqual(proc.returncode, 0, f"CLI runner failed with code {proc.returncode}: {proc.stderr}")
        res = json.loads(proc.stdout)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "fulfillment_submitted")
        self.assertGreaterEqual(res["pdfSizeBytes"], 1_000_000)


if __name__ == "__main__":
    import wave
    unittest.main()
