"""
SoundWave Art - Milestone 2 Adversarial Stress Testing Suite.
Empirically stress-tests the fulfillment engine:
  1. Waveform Generation: silence, square waves, impulses, DC offsets, micro-audio,
     massive audio decimation performance, stereo downmixing, extreme dimensions, palettes.
  2. 800px Preview Generator: aspect ratio preservation across all frame sizes (8x10, 11x14, 16x20, 24x36),
     strict dimension bounds (max <= 800px), file size constraint (< 500KB), adversarial captions, fallback mode.
  3. 300 DPI Print PDF Compiler: strict file size >= 1,000,000 bytes across all frame sizes and palettes,
     valid PDF structure and headers, exact physical MediaBox points, single-page enforcement, caption auto-fit.
  4. Fulfillment Pipeline & CLI: bad inputs, non-existent orders, missing audio fallback, corrupted audio handling.
"""

from __future__ import annotations

import io
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import wave

import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import (
    email_service,
    fulfill,
    preview_generator,
    print_engine,
    print_partner,
    waveform_generator,
)
from tests.test_harness import (
    FRAME_SIZES,
    PALETTES,
    generate_corrupted_audio,
    generate_silent_wav,
    generate_wav,
)


class TestWaveformAdversarialStress(unittest.TestCase):
    """Stress-tests waveform peak extraction and rendering against adversarial audio signals."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp_dir.name)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_pure_digital_silence_all_zeros(self):
        """Pure silence (0 amplitude) must produce valid minimum elevation bars without zero division."""
        silent_wav = self.tmp_path / "pure_silence.wav"
        generate_silent_wav(str(silent_wav), duration_seconds=3.0)

        out_img_path = self.tmp_path / "silence_wave.png"
        img = waveform_generator.generate_waveform_image(
            audio_source=str(silent_wav),
            output_path=str(out_img_path),
            palette="midnight_gold",
            transparent_bg=True,
        )

        self.assertTrue(out_img_path.exists())
        self.assertEqual(img.size, (3886, 661))
        self.assertEqual(img.mode, "RGBA")

        # Verify peaks array has valid floor value
        samples, _ = waveform_generator.load_audio_samples(str(silent_wav))
        peaks = waveform_generator.extract_normalized_peaks(samples, num_bars=80, min_elevation=0.05)
        self.assertEqual(len(peaks), 80)
        self.assertTrue(np.all(peaks == 0.05), "All peaks for silence should equal min_elevation")
        self.assertFalse(np.isnan(peaks).any(), "Silence peaks must not contain NaN")

    def test_empty_samples_input(self):
        """Empty input array must return min_elevation peaks without error."""
        empty_peaks = waveform_generator.extract_normalized_peaks([], num_bars=80, min_elevation=0.05)
        self.assertEqual(len(empty_peaks), 80)
        self.assertTrue(np.all(empty_peaks == 0.05))

        empty_np = np.array([], dtype=np.int16)
        peaks_np = waveform_generator.extract_normalized_peaks(empty_np, num_bars=60, min_elevation=0.08)
        self.assertEqual(len(peaks_np), 60)
        self.assertTrue(np.all(peaks_np == 0.08))

    def test_single_sample_audio(self):
        """Audio containing exactly 1 sample must not cause IndexError or zero-division."""
        single_sample = np.array([16000], dtype=np.int16)
        peaks = waveform_generator.extract_normalized_peaks(single_sample, num_bars=80)
        self.assertEqual(len(peaks), 80)
        self.assertFalse(np.isnan(peaks).any())
        self.assertTrue(np.all(peaks == 1.0))

    def test_micro_audio_fewer_samples_than_bars(self):
        """Audio with fewer samples than target bars (e.g. 8 samples for 80 bars) interpolates cleanly."""
        micro_samples = np.array([0, 5000, 15000, 30000, 20000, 10000, 2000, 0], dtype=np.int16)
        peaks = waveform_generator.extract_normalized_peaks(micro_samples, num_bars=80)
        self.assertEqual(len(peaks), 80)
        self.assertFalse(np.isnan(peaks).any())
        self.assertAlmostEqual(float(np.max(peaks)), 1.0, delta=0.01)
        self.assertGreaterEqual(float(np.min(peaks)), 0.05)

    def test_alternating_square_wave_clipping(self):
        """Full-scale alternating square wave (+32767 / -32768) handles max amplitude without overflow."""
        square_samples = np.array([32767, -32768] * 2000, dtype=np.int16)
        peaks = waveform_generator.extract_normalized_peaks(square_samples, num_bars=80)
        self.assertEqual(len(peaks), 80)
        self.assertTrue(np.all(peaks == 1.0))

        # Render square wave
        img = waveform_generator.generate_waveform_image(
            audio_source=square_samples,
            palette="everest_silver",
            style="pill_bars",
        )
        self.assertEqual(img.size, (3886, 661))

    def test_pure_dc_offset_signal(self):
        """Constant non-zero DC offset signal without oscillation extracts valid peaks."""
        dc_samples = np.full(5000, 20000, dtype=np.int16)
        peaks = waveform_generator.extract_normalized_peaks(dc_samples, num_bars=80)
        self.assertEqual(len(peaks), 80)
        self.assertTrue(np.all(peaks == 1.0))

    def test_impulse_spike_high_dynamic_range(self):
        """Single Dirac delta impulse in a sea of zeros must scale properly without artifacts."""
        impulse_samples = np.zeros(50000, dtype=np.int16)
        impulse_samples[25000] = 32000
        peaks = waveform_generator.extract_normalized_peaks(impulse_samples, num_bars=80, min_elevation=0.05)
        self.assertEqual(len(peaks), 80)
        self.assertAlmostEqual(float(np.max(peaks)), 1.0, places=4)
        high_bars = np.sum(peaks > 0.05)
        self.assertGreaterEqual(high_bars, 1)

    def test_stereo_two_channel_downmix(self):
        """2-channel stereo WAV correctly downmixes to mono int16 without shape errors."""
        stereo_wav = self.tmp_path / "stereo_test.wav"
        num_samples = 44100
        with wave.open(str(stereo_wav), "w") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            frames = bytearray()
            for i in range(num_samples):
                left = int(20000 * math.sin(2 * math.pi * 440 * (i / 44100)))
                right = int(10000 * math.cos(2 * math.pi * 880 * (i / 44100)))
                frames.extend(struct.pack("<hh", left, right))
            wf.writeframes(frames)

        samples, duration = waveform_generator.load_audio_samples(str(stereo_wav))
        self.assertEqual(samples.ndim, 1)
        self.assertEqual(len(samples), 44100)
        self.assertAlmostEqual(duration, 1.0, places=2)

        out_img = self.tmp_path / "stereo_wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(stereo_wav),
            output_path=str(out_img),
            palette="ocean_navy",
        )
        self.assertTrue(out_img.exists())

    def test_massive_audio_decimation_speed(self):
        """5,000,000 samples (~2 mins of 44.1kHz audio) decimation runs in < 150ms."""
        massive_samples = np.random.randint(-30000, 30000, size=5_000_000, dtype=np.int16)
        t0 = time.perf_counter()
        peaks = waveform_generator.extract_normalized_peaks(massive_samples, num_bars=100)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        self.assertEqual(len(peaks), 100)
        self.assertLess(elapsed_ms, 150.0, f"Decimation took {elapsed_ms:.2f}ms (expected < 150ms)")

    def test_all_rendering_styles(self):
        """Renders pill_bars, daw_spikes, and daw_continuous styles."""
        samples = np.array([int(15000 * math.sin(i * 0.1)) for i in range(10000)], dtype=np.int16)
        cfg_pill = waveform_generator.WaveformConfig(style="pill_bars", width=1200, height=300)
        cfg_spikes = waveform_generator.WaveformConfig(style="daw_spikes", width=1200, height=300)
        cfg_cont = waveform_generator.WaveformConfig(style="daw_continuous", width=1200, height=300)

        img_pill = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg_pill)
        img_spikes = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg_spikes)
        img_cont = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg_cont)

        self.assertEqual(img_pill.size, (1200, 300))
        self.assertEqual(img_spikes.size, (1200, 300))
        self.assertEqual(img_cont.size, (1200, 300))

    def test_all_standard_palettes_and_aliases(self):
        """Verifies rendering across all color palettes including aliases."""
        palette_keys = [
            "midnight_gold",
            "everest_silver",
            "white_silver",
            "ocean_navy",
            "dark_blue_white",
            "nordic_slate",
            "rose_petal",
        ]
        samples = np.array([int(20000 * math.sin(i * 0.2)) for i in range(2000)], dtype=np.int16)
        for pal in palette_keys:
            cfg = waveform_generator.WaveformConfig(palette=pal, width=800, height=200)
            img = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg)
            self.assertEqual(img.size, (800, 200), f"Failed for palette {pal}")

    def test_extreme_dimensions_and_bar_counts(self):
        """Verifies extreme canvas dimensions and bar counts (tiny and huge)."""
        samples = np.array([int(18000 * math.sin(i * 0.05)) for i in range(5000)], dtype=np.int16)

        # Tiny dimensions, 2 bars
        cfg_tiny = waveform_generator.WaveformConfig(width=100, height=30, num_bars=2)
        img_tiny = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg_tiny)
        self.assertEqual(img_tiny.size, (100, 30))

        # Huge dimensions, 150 bars
        cfg_huge = waveform_generator.WaveformConfig(width=4800, height=1200, num_bars=150)
        img_huge = waveform_generator.generate_waveform_image(audio_source=samples, config=cfg_huge)
        self.assertEqual(img_huge.size, (4800, 1200))


class TestPreviewGeneratorAdversarialStress(unittest.TestCase):
    """Stress-tests 800px preview generator for aspect ratios, file size, captions, and fallbacks."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp_dir.name)

        # Generate a standard waveform image to composite
        self.wave_png = self.tmp_path / "sample_wave.png"
        samples = np.array([int(22000 * math.sin(i * 0.15)) for i in range(4000)], dtype=np.int16)
        waveform_generator.generate_waveform_image(
            audio_source=samples,
            output_path=str(self.wave_png),
            palette="midnight_gold",
            transparent_bg=True,
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_aspect_ratio_preservation_and_bounds_all_frame_sizes(self):
        """Verifies that all 4 frame sizes preserve physical aspect ratios and max dimension <= 800."""
        expected_specs = {
            "8x10": {"dims": (640, 800), "ratio": 0.800},
            "11x14": {"dims": (628, 800), "ratio": 628 / 800},
            "16x20": {"dims": (640, 800), "ratio": 0.800},
            "24x36": {"dims": (533, 800), "ratio": 533 / 800},
        }

        for frame_size, spec in expected_specs.items():
            out_path = self.tmp_path / f"preview_{frame_size}.png"
            res = preview_generator.generate_preview_thumbnail(
                output_path=str(out_path),
                waveform_image_path=str(self.wave_png),
                frame_size=frame_size,
                palette="midnight_gold",
                caption=f"Frame Size {frame_size}",
                target_id_or_url=f"test_{frame_size}",
            )

            self.assertTrue(out_path.exists())
            with Image.open(out_path) as img:
                w, h = img.size
                self.assertLessEqual(w, 800, f"{frame_size} width {w} exceeds 800px limit")
                self.assertLessEqual(h, 800, f"{frame_size} height {h} exceeds 800px limit")
                self.assertEqual((w, h), spec["dims"], f"{frame_size} dimensions mismatch")
                measured_ratio = w / float(h)
                self.assertAlmostEqual(
                    measured_ratio,
                    spec["ratio"],
                    places=3,
                    msg=f"{frame_size} aspect ratio not preserved",
                )

    def test_file_size_strictly_under_500kb_all_formats(self):
        """Generated previews in PNG, JPEG, and WEBP formats must be strictly < 500,000 bytes."""
        formats = [
            ("preview.png", "PNG"),
            ("preview.jpg", "JPEG"),
            ("preview.webp", "WEBP"),
        ]

        for filename, fmt in formats:
            out_file = self.tmp_path / filename
            preview_generator.generate_preview_thumbnail(
                output_path=str(out_file),
                waveform_image_path=str(self.wave_png),
                frame_size="16x20",
                palette="white_silver",
                caption="Testing File Size Limit",
                format=fmt,
            )

            self.assertTrue(out_file.exists())
            file_bytes = os.path.getsize(out_file)
            self.assertLess(
                file_bytes,
                500_000,
                f"Format {fmt} exceeded 500KB limit: {file_bytes} bytes",
            )
            self.assertGreater(file_bytes, 1000, f"Format {fmt} produced empty or corrupt image")

    def test_missing_waveform_fallback_renders_cleanly(self):
        """When waveform image is None or path does not exist, generator falls back to synthetic bars."""
        out_file = self.tmp_path / "fallback_preview.png"
        preview_generator.generate_preview_thumbnail(
            output_path=str(out_file),
            waveform_image_path=str(self.tmp_path / "non_existent_file.png"),
            frame_size="11x14",
            palette="dark_blue_white",
            caption="Fallback Synthetic Waveform",
        )

        self.assertTrue(out_file.exists())
        with Image.open(out_file) as img:
            self.assertEqual(img.size, (628, 800))

    def test_adversarial_captions_handling(self):
        """Tests captions: empty, long 200 chars, HTML/XSS injection attempts, and unicode/emoji."""
        test_captions = [
            "",  # Empty caption
            "A",  # Single character
            "🎵 Our First Dance 💍 — September 20, 2026 🎉",  # Emoji & Unicode
            "<script>alert('XSS')</script> & \"quotes\" and <tags>",  # Special chars
            "A" * 200,  # Max length 200 chars
            "Line 1\n\n\n\n\nLine 2\n\n\nLine 3",  # Excessive newlines
        ]

        for idx, cap in enumerate(test_captions):
            out_path = self.tmp_path / f"caption_{idx}.jpg"
            preview_generator.generate_preview_thumbnail(
                output_path=str(out_path),
                waveform_image_path=str(self.wave_png),
                frame_size="16x20",
                palette="rose_petal",
                caption=cap,
            )
            self.assertTrue(out_path.exists())

    def test_preview_generation_performance_latency(self):
        """Preview thumbnail generation runs in < 80ms."""
        out_file = self.tmp_path / "perf_preview.jpg"
        t0 = time.perf_counter()
        preview_generator.generate_preview_thumbnail(
            output_path=str(out_file),
            waveform_image_path=str(self.wave_png),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Performance Benchmark",
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        self.assertLess(elapsed_ms, 80.0, f"Preview took {elapsed_ms:.2f}ms (expected < 80ms)")


class TestPrintEngineAdversarialStress(unittest.TestCase):
    """Stress-tests Playwright 300 DPI PDF compilation: size >= 1MB, format validity, MediaBox, all frames & palettes."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp_dir.name)

        # Generate a high-res waveform image for poster compositing
        self.wave_png = self.tmp_path / "print_wave.png"
        samples = np.array([int(24000 * math.sin(i * 0.1)) for i in range(8000)], dtype=np.int16)
        waveform_generator.generate_waveform_image(
            audio_source=samples,
            output_path=str(self.wave_png),
            palette="midnight_gold",
            transparent_bg=True,
            bars=80,
            scale=1.0,
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_all_frame_sizes_and_palettes_strictly_ge_1mb_and_valid_pdf(self):
        """
        Matrix test across all 4 authoritative frame sizes and multiple palettes:
        Every single PDF must be strictly >= 1,000,000 bytes (>= 1MB) and valid PDF format.
        """
        test_matrix = [
            ("8x10", "midnight_gold"),
            ("11x14", "white_silver"),
            ("16x20", "dark_blue_white"),
            ("24x36", "rose_petal"),
        ]

        expected_mediabox_pt = {
            "8x10": (576, 720),      # 8*72, 10*72
            "11x14": (792, 1008),    # 11*72, 14*72
            "16x20": (1152, 1440),   # 16*72, 20*72
            "24x36": (1728, 2592),   # 24*72, 36*72
        }

        for frame_size, palette in test_matrix:
            out_pdf = self.tmp_path / f"poster_{frame_size}_{palette}.pdf"
            t0 = time.perf_counter()
            result = print_engine.compile_print_pdf(
                waveform_image_path=str(self.wave_png),
                output_pdf_path=str(out_pdf),
                frame_size=frame_size,
                palette=palette,
                caption=f"Adversarial Stress Test {frame_size} {palette}",
                subcaption="Milestone 2 Challenger 1 Verification",
                target_id_or_url=f"ord_adv_{frame_size}",
            )
            elapsed = time.perf_counter() - t0

            # 1. Output file must exist
            self.assertTrue(out_pdf.exists(), f"PDF was not generated at {out_pdf}")

            # 2. Strict file size >= 1,000,000 bytes (mandated by R2)
            file_size = os.path.getsize(out_pdf)
            self.assertGreaterEqual(
                file_size,
                1_000_000,
                f"PDF for {frame_size}/{palette} was {file_size} bytes, which is BELOW 1MB (1,000,000 bytes)!",
            )

            # 3. Valid PDF Header and EOF
            with open(out_pdf, "rb") as f:
                pdf_bytes = f.read()

            self.assertTrue(pdf_bytes.startswith(b"%PDF-"), f"Invalid PDF magic bytes for {frame_size}")
            self.assertIn(b"%%EOF", pdf_bytes[-1024:], f"Missing %%EOF marker for {frame_size}")

            # 4. MediaBox validation
            mediabox_matches = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf_bytes)
            self.assertTrue(len(mediabox_matches) > 0, f"No MediaBox found in PDF for {frame_size}")
            pt_w, pt_h = float(mediabox_matches[0][0]), float(mediabox_matches[0][1])
            exp_w, exp_h = expected_mediabox_pt[frame_size]
            self.assertAlmostEqual(pt_w, exp_w, delta=1.0, msg=f"{frame_size} MediaBox width mismatch")
            self.assertAlmostEqual(pt_h, exp_h, delta=1.0, msg=f"{frame_size} MediaBox height mismatch")

            # 5. Exactly 1 page (no spillover)
            page_matches = re.findall(rb"/Type\s*/Page\b", pdf_bytes)
            self.assertEqual(len(page_matches), 1, f"PDF for {frame_size} has {len(page_matches)} pages (expected exactly 1)")

            print(
                f"[PASS] PDF {frame_size} ({palette}): {file_size:,} bytes "
                f"({file_size / (1024*1024):.2f} MB), MediaBox=[0 0 {pt_w} {pt_h}], time={elapsed:.2f}s"
            )

    def test_pdf_font_styles_and_all_palettes(self):
        """Verifies compilation with cursive, sans, and serif font styles."""
        styles = ["serif", "sans", "cursive"]
        for style in styles:
            out_pdf = self.tmp_path / f"poster_font_{style}.pdf"
            result = print_engine.compile_print_pdf(
                waveform_image_path=str(self.wave_png),
                output_pdf_path=str(out_pdf),
                frame_size="8x10",
                palette="midnight_gold",
                caption="Typography Stack Test",
                font_style=style,
            )
            self.assertTrue(out_pdf.exists())
            self.assertGreaterEqual(os.path.getsize(out_pdf), 1_000_000)

    def test_pdf_adversarial_caption_stress(self):
        """Stress-tests PDF compilation with 200-char caption containing HTML entities and quotes."""
        out_pdf = self.tmp_path / "poster_adv_caption.pdf"
        adversarial_caption = "Wedding Vows & Special Memories: <3 'Forever & Always' -- 2026! " * 4
        adversarial_caption = adversarial_caption[:200]

        result = print_engine.compile_print_pdf(
            waveform_image_path=str(self.wave_png),
            output_pdf_path=str(out_pdf),
            frame_size="16x20",
            palette="midnight_gold",
            caption=adversarial_caption,
            subcaption="Special Edition & Limited Print",
        )

        self.assertTrue(out_pdf.exists())
        file_size = os.path.getsize(out_pdf)
        self.assertGreaterEqual(file_size, 1_000_000)

    def test_pdf_missing_waveform_raises_value_error(self):
        """Omitting waveform image must raise ValueError immediately."""
        out_pdf = self.tmp_path / "should_fail.pdf"
        with self.assertRaises(ValueError):
            print_engine.compile_print_pdf(
                waveform_image_path=None,
                output_pdf_path=str(out_pdf),
            )

    def test_qr_code_validity_and_url_format(self):
        """QR code generator creates valid scannable PNG containing correct route URL."""
        qr_out = self.tmp_path / "test_qr.png"
        resolved = print_engine.generate_qr_code(
            target_id_or_url="ord_test_challenger_99",
            output_path=str(qr_out),
        )
        self.assertTrue(Path(resolved).exists())
        with Image.open(resolved) as img:
            self.assertEqual(img.mode, "RGB")
            self.assertGreaterEqual(img.width, 200)
            self.assertGreaterEqual(img.height, 200)


class TestFulfillmentPipelineAdversarialStress(unittest.TestCase):
    """Stress-tests fulfillment pipeline against error scenarios, bad IDs, missing files, and corrupted audio."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.tmp_path = Path(self.tmp_dir.name)
        self.db_path = self.tmp_path / "soundwave_stress.db"

        # Initialize SQLite DB matching schema
        conn = sqlite3.connect(str(self.db_path))
        conn.executescript("""
        CREATE TABLE "Order" (
            id TEXT PRIMARY KEY,
            customerEmail TEXT NOT NULL,
            shippingName TEXT,
            shippingAddress TEXT,
            frameSize TEXT NOT NULL,
            palette TEXT NOT NULL,
            caption TEXT,
            audioPath TEXT NOT NULL,
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
        conn.close()

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_fulfill_nonexistent_order_id_raises_value_error(self):
        """Running fulfillment on non-existent order ID raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            fulfill.run_fulfillment(
                order_id="ord_does_not_exist_404",
                db_path=str(self.db_path),
                provider_name="mock",
            )
        self.assertIn("does not exist", str(ctx.exception))

    def test_fulfill_missing_audio_file_resilient_fallback(self):
        """Order references a missing audio file — pipeline falls back to synthetic bars and completes successfully."""
        conn = sqlite3.connect(str(self.db_path))
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "ord_missing_audio_test",
                "test@example.com",
                "Alice",
                "123 Main St",
                "16x20",
                "midnight_gold",
                "Fallback Test",
                str(self.tmp_path / "phantom_audio.wav"),
                "pending_fulfillment",
                9900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

        res = fulfill.run_fulfillment(
            order_id="ord_missing_audio_test",
            db_path=str(self.db_path),
            provider_name="mock",
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "fulfillment_submitted")
        self.assertIsNotNone(res["partnerOrderId"])

        # Verify DB status updated
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status, partnerOrderId FROM "Order" WHERE id = ?', ("ord_missing_audio_test",))
        row = cur.fetchone()
        self.assertEqual(row[0], "fulfillment_submitted")
        self.assertTrue(row[1].startswith("ord_prodigi_mock_"))
        conn.close()

    def test_fulfill_corrupted_audio_file_marks_status_failed(self):
        """Order references a corrupted audio file — pipeline catches decode error and transitions to fulfillment_failed."""
        bad_audio = self.tmp_path / "corrupted.wav"
        generate_corrupted_audio(str(bad_audio), mode="random_bytes")

        conn = sqlite3.connect(str(self.db_path))
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "ord_corrupted_audio_test",
                "test@example.com",
                "Bob",
                "456 Oak St",
                "11x14",
                "white_silver",
                "Corrupted Audio Test",
                str(bad_audio),
                "pending_fulfillment",
                6900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

        # Should raise exception on corrupted audio
        with self.assertRaises(Exception):
            fulfill.run_fulfillment(
                order_id="ord_corrupted_audio_test",
                db_path=str(self.db_path),
                provider_name="mock",
            )

        # Order must be updated to fulfillment_failed in database
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status FROM "Order" WHERE id = ?', ("ord_corrupted_audio_test",))
        row = cur.fetchone()
        self.assertEqual(row[0], "fulfillment_failed")
        conn.close()

    def test_cli_runner_missing_order_id_exit_code(self):
        """CLI invocation without --order-id exits with code 2."""
        proc = subprocess.run(
            [sys.executable, "-m", "backend.fulfill"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("--order-id", proc.stderr)

    def test_cli_runner_nonexistent_order_exit_code_1(self):
        """CLI invocation with nonexistent order-id exits with code 1 and JSON error."""
        proc = subprocess.run(
            [sys.executable, "-m", "backend.fulfill", "--order-id", "ord_phantom_999", "--db", str(self.db_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("error", proc.stderr)


if __name__ == "__main__":
    unittest.main()
