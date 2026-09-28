"""
tests/test_m6_challenger2_pdf_stress.py
Independent Empirical Stress Harness for Challenger 2 (Milestone 6)
Backend Fulfillment & High-Resolution PDF Engine Adversarial Verification.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
import unittest

import numpy as np
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

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

ALL_THEMES = [
    "botanical",
    "modern_border",
    "arch",
    "art_deco",
    "vintage_grunge",
    "luxury_marble",
    "abstract_geometric",
    "celestial",
]

ALL_SIZES = ["8x10", "11x14", "16x20", "24x36"]

EXPECTED_MEDIABOX = {
    "8x10": (576.0, 720.0),
    "11x14": (792.0, 1008.0),
    "16x20": (1152.0, 1440.0),
    "24x36": (1728.0, 2592.0),
}


def parse_pdf_mediabox(pdf_path: str) -> list[tuple[float, float, float, float]]:
    with open(pdf_path, "rb") as f:
        data = f.read()
    matches = re.findall(rb"/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]", data)
    boxes = []
    for m in matches:
        boxes.append((float(m[0]), float(m[1]), float(m[2]), float(m[3])))
    return boxes


def make_waveform(path: str, width: int = 2400, height: int = 600) -> str:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bars = 64
    bw = int((width / bars) * 0.6)
    for i in range(bars):
        h = int((height * 0.4) * (math.sin(i * 0.25) ** 2 + 0.2))
        x0 = int(i * (width / bars) + (width / bars - bw) / 2)
        y0 = (height - h) // 2
        draw.rounded_rectangle([x0, y0, x0 + bw, y0 + h], radius=bw // 2, fill=(212, 175, 55, 240))
    img.save(path, format="PNG")
    return path


def make_photo(path: str, width: int, height: int, mode: str = "RGB") -> str:
    img = Image.new(mode, (width, height), (220, 190, 170) if mode == "RGB" else (220, 190, 170, 255))
    draw = ImageDraw.Draw(img)
    draw.line([(0, 0), (width, height)], fill=(120, 60, 30) if mode == "RGB" else (120, 60, 30, 255), width=max(2, width // 40))
    draw.line([(0, height), (width, 0)], fill=(40, 90, 150) if mode == "RGB" else (40, 90, 150, 255), width=max(2, width // 40))
    r = min(width, height) // 4
    draw.ellipse([(width // 2 - r, height // 2 - r), (width // 2 + r, height // 2 + r)], fill=(180, 120, 80) if mode == "RGB" else (180, 120, 80, 255))
    if path.lower().endswith(".png"):
        img.save(path, format="PNG")
    else:
        img.save(path, format="JPEG", quality=90)
    return path


class EmpiricalChallengerM6Suite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.td = tempfile.mkdtemp(prefix="challenger_m6_")
        cls.wave_png = make_waveform(os.path.join(cls.td, "test_wave.png"))
        cls.photo_std = make_photo(os.path.join(cls.td, "test_photo_std.jpg"), 1200, 900)
        cls.results: dict[str, list[dict]] = {
            "pdf_theme_matrix": [],
            "pdf_size_matrix": [],
            "pdf_soundwave_only": [],
            "pdf_adversarial_photos": [],
            "preview_thumbnails": [],
            "texture_entropy": [],
        }

    @classmethod
    def tearDownClass(cls):
        # Save measurements to tests/challenger_m6_2_measurements.json
        out_json = PROJECT_ROOT / "tests" / "challenger_m6_2_measurements.json"
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(cls.results, f, indent=2)
        shutil.rmtree(cls.td, ignore_errors=True)

    def test_01_pdf_across_all_8_themes(self):
        """Matrix 1: Verify all 8 themes produce valid PDF >= 1,000,000 bytes with photo on 8x10."""
        for theme in ALL_THEMES:
            out_pdf = os.path.join(self.td, f"theme_{theme}_8x10.pdf")
            t0 = time.time()
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                photo_image_path=self.photo_std,
                output_pdf_path=out_pdf,
                frame_size="8x10",
                decorative_theme=theme,
                palette="midnight_gold",
                caption=f"Empirical Theme Test: {theme}",
            )
            elapsed = time.time() - t0
            self.assertTrue(os.path.exists(out_pdf))
            fsize = os.path.getsize(out_pdf)

            # Strict file size invariant: >= 1,000,000 bytes
            self.assertGreaterEqual(
                fsize,
                1_000_000,
                f"Theme '{theme}' generated PDF with size {fsize} bytes (< 1,000,000 bytes)",
            )

            # Header check
            with open(out_pdf, "rb") as f:
                head = f.read(5)
                self.assertEqual(head, b"%PDF-")

            self.results["pdf_theme_matrix"].append({
                "theme": theme,
                "frame_size": "8x10",
                "bytes": fsize,
                "mb": round(fsize / (1024 * 1024), 2),
                "elapsed_sec": round(elapsed, 2),
                "status": "PASS",
            })

    def test_02_pdf_across_all_4_frame_sizes_and_mediabox(self):
        """Matrix 2: Verify all 4 frame sizes produce valid PDF >= 1,000,000 bytes and exact MediaBox points."""
        size_theme_pairs = [
            ("8x10", "botanical"),
            ("11x14", "modern_border"),
            ("16x20", "arch"),
            ("24x36", "celestial"),
        ]
        for size, theme in size_theme_pairs:
            out_pdf = os.path.join(self.td, f"size_{size}_{theme}.pdf")
            t0 = time.time()
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                photo_image_path=self.photo_std,
                output_pdf_path=out_pdf,
                frame_size=size,
                decorative_theme=theme,
                palette="champagne_gold",
                caption=f"Frame Size {size} MediaBox Check",
            )
            elapsed = time.time() - t0
            self.assertTrue(os.path.exists(out_pdf))
            fsize = os.path.getsize(out_pdf)

            # Invariant: >= 1,000,000 bytes
            self.assertGreaterEqual(fsize, 1_000_000)

            # MediaBox validation
            boxes = parse_pdf_mediabox(out_pdf)
            self.assertGreater(len(boxes), 0, f"No MediaBox in {size} PDF")
            _, _, w, h = boxes[0]
            exp_w, exp_h = EXPECTED_MEDIABOX[size]
            self.assertAlmostEqual(w, exp_w, delta=1.0, msg=f"Width mismatch for {size}")
            self.assertAlmostEqual(h, exp_h, delta=1.0, msg=f"Height mismatch for {size}")

            self.results["pdf_size_matrix"].append({
                "frame_size": size,
                "theme": theme,
                "bytes": fsize,
                "mb": round(fsize / (1024 * 1024), 2),
                "mediabox": [w, h],
                "expected_mediabox": list(EXPECTED_MEDIABOX[size]),
                "elapsed_sec": round(elapsed, 2),
                "status": "PASS",
            })

    def test_03_pdf_soundwave_only_all_themes(self):
        """Matrix 3: Verify soundwave-only mode compiles >= 1,000,000 bytes across themes."""
        for theme in ["arch", "art_deco", "vintage_grunge", "luxury_marble"]:
            out_pdf = os.path.join(self.td, f"sw_only_{theme}.pdf")
            t0 = time.time()
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                photo_image_path=None,
                output_pdf_path=out_pdf,
                frame_size="16x20",
                decorative_theme=theme,
                palette="lavender_mist",
                caption=f"Soundwave-Only {theme}",
            )
            elapsed = time.time() - t0
            fsize = os.path.getsize(out_pdf)
            self.assertGreaterEqual(fsize, 1_000_000)

            self.results["pdf_soundwave_only"].append({
                "theme": theme,
                "bytes": fsize,
                "mb": round(fsize / (1024 * 1024), 2),
                "elapsed_sec": round(elapsed, 2),
                "status": "PASS",
            })

    def test_04_pdf_adversarial_photo_inputs(self):
        """Matrix 4: Stress-test unusual photo aspect ratios and extreme sizes."""
        photo_specs = [
            ("square_1x1", make_photo(os.path.join(self.td, "p_sq.jpg"), 800, 800)),
            ("ultrawide_21x9", make_photo(os.path.join(self.td, "p_uw.jpg"), 2100, 900)),
            ("vertical_9x16", make_photo(os.path.join(self.td, "p_vert.jpg"), 720, 1280)),
            ("tiny_10x10", make_photo(os.path.join(self.td, "p_tiny.png"), 10, 10, mode="RGBA")),
            ("large_3000x2000", make_photo(os.path.join(self.td, "p_large.jpg"), 3000, 2000)),
        ]

        for label, photo_path in photo_specs:
            out_pdf = os.path.join(self.td, f"adv_photo_{label}.pdf")
            t0 = time.time()
            res = compile_print_pdf(
                waveform_image_path=self.wave_png,
                photo_image_path=photo_path,
                output_pdf_path=out_pdf,
                frame_size="11x14",
                decorative_theme="modern_border",
                caption=f"Adversarial Photo Stress: {label}",
            )
            elapsed = time.time() - t0
            fsize = os.path.getsize(out_pdf)
            self.assertGreaterEqual(fsize, 1_000_000)

            self.results["pdf_adversarial_photos"].append({
                "photo_type": label,
                "bytes": fsize,
                "mb": round(fsize / (1024 * 1024), 2),
                "elapsed_sec": round(elapsed, 2),
                "status": "PASS",
            })

    def test_05_preview_thumbnails_all_themes_and_sizes(self):
        """Matrix 5: Strictly verify preview thumbnail generation < 500 KB and max dim <= 800px."""
        for size in ALL_SIZES:
            for theme in ALL_THEMES:
                out_thumb = os.path.join(self.td, f"preview_{theme}_{size}.jpg")
                generate_preview_thumbnail(
                    waveform_image_path=self.wave_png,
                    photo_image_path=self.photo_std,
                    output_path=out_thumb,
                    frame_size=size,
                    decorative_theme=theme,
                    caption=f"Preview {theme} {size}",
                    format="JPEG",
                    quality=85,
                )
                self.assertTrue(os.path.exists(out_thumb))
                tsize = os.path.getsize(out_thumb)

                # Strict Invariant: < 500 KB (500 * 1024 bytes)
                self.assertLess(
                    tsize,
                    500 * 1024,
                    f"Preview thumbnail for {theme} {size} was {tsize} bytes (>= 500 KB)",
                )

                # Verification of dimensions <= 800px
                with Image.open(out_thumb) as img:
                    w, h = img.size
                    self.assertLessEqual(max(w, h), 800)

                self.results["preview_thumbnails"].append({
                    "frame_size": size,
                    "theme": theme,
                    "bytes": tsize,
                    "kb": round(tsize / 1024, 2),
                    "dimensions": [w, h],
                    "status": "PASS",
                })

    def test_06_fine_art_canvas_texture_entropy(self):
        """Matrix 6: Verify texture noise entropy across 3 representative palettes."""
        test_palettes = [
            ("midnight_gold", "#0c0c0c"),
            ("botanical_sage", "#f6f8f5"),
            ("white_silver", "#ffffff"),
        ]
        for name, hex_val in test_palettes:
            tex_path = generate_fine_art_texture(2400, 3000, hex_val)
            self.assertTrue(os.path.exists(tex_path))
            fsize = os.path.getsize(tex_path)

            with Image.open(tex_path) as img:
                arr = np.array(img, dtype=float)
                std = float(np.std(arr))
                # Archival matte paper tooth must have standard deviation > 0.5 to prevent DCT compression collapse
                self.assertGreater(std, 0.5, f"Palette {name} ({hex_val}) texture entropy too low: {std}")

            self.results["texture_entropy"].append({
                "palette": name,
                "hex": hex_val,
                "file_size_bytes": fsize,
                "std_deviation": round(std, 3),
                "status": "PASS",
            })
            os.remove(tex_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
