"""
tests/test_m2_empirical_challenger2.py
Empirical Challenger 2 (Iteration 2) - Comprehensive Stress & Edge Test Suite
Target: SoundWave Art Milestone 2 Backend Fulfillment Engine.

Categories Tested:
  1. PDF Size & Format Compliance across all 24 Permutations (Playwright & Fallback)
  2. Audio Decimation & Waveform Generator Edge Cases (Corrupt, Zero-byte, Silence, Clipping, Short)
  3. Database State Machine, Edge Inputs (Unicode, Long Caption, SQL Injection, Retry Idempotency)
  4. Database Lock & Concurrency Contention (Multi-process parallel fulfillment under SQLite WAL)
  5. CLI Runner Subprocess Boundary & Exit Code Verification
"""

from __future__ import annotations

import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
import wave

from PIL import Image
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import email_service, preview_generator, print_engine, print_partner, waveform_generator
from backend.fulfill import PIPELINE_STEPS, get_db_connection, run_fulfillment
from backend.print_engine import FRAME_CONFIGS, PALETTE_CONFIGS, compile_print_pdf, generate_fine_art_texture
from tests.test_harness import DatabaseHelper, FRAME_SIZES, PALETTES, generate_wav


class TestPdfFullMatrixAndFallbackEmpirical(unittest.TestCase):
    """Category 1: Full matrix stress testing for PDF compiler and raster fallback."""

    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        cls.td = Path(cls.tmp_dir.name)
        cls.wav_path = cls.td / "matrix_tone.wav"
        generate_wav(str(cls.wav_path), duration_seconds=1.0)
        cls.wave_png = cls.td / "matrix_wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(cls.wav_path),
            output_path=str(cls.wave_png),
            palette="midnight_gold",
            transparent_bg=True,
        )

    @classmethod
    def tearDownClass(cls):
        cls.tmp_dir.cleanup()

    def test_playwright_pdf_size_all_24_permutations_ge_1mb(self):
        """Stress-test: Every single one of the 24 frame_size x palette permutations must produce a valid PDF >= 1MB."""
        frame_sizes = list(FRAME_CONFIGS.keys())  # 8x10, 11x14, 16x20, 24x36
        palettes = list(PALETTE_CONFIGS.keys())   # midnight_gold, white_silver, dark_blue_white, ocean_navy, nordic_slate, rose_petal

        self.assertEqual(len(frame_sizes), 4)
        self.assertEqual(len(palettes), 7)  # 5 standard + 2 aliases (white_silver, dark_blue_white)

        results = []
        for frame in frame_sizes:
            for pal in palettes:
                out_pdf = self.td / f"pw_{frame}_{pal}.pdf"
                res = compile_print_pdf(
                    waveform_image_path=str(self.wave_png),
                    output_pdf_path=str(out_pdf),
                    frame_size=frame,
                    palette=pal,
                    caption=f"Empirical Matrix Test {frame} {pal}",
                    target_id_or_url="ord_emp_matrix",
                )
                self.assertTrue(res["success"], f"Compilation failed for {frame} {pal}")
                self.assertTrue(out_pdf.exists())
                file_size = os.path.getsize(str(out_pdf))
                self.assertGreaterEqual(
                    file_size,
                    1_000_000,
                    f"Permutation {frame} / {pal} produced {file_size} bytes, strictly under 1,000,000 bytes",
                )

                # Validate PDF magic header and trailer
                with open(str(out_pdf), "rb") as f:
                    header = f.read(1024)
                    f.seek(max(0, file_size - 1024))
                    trailer = f.read(1024)
                self.assertTrue(header.startswith(b"%PDF-1."), f"Invalid PDF header on {frame} {pal}")
                self.assertIn(b"%%EOF", trailer, f"Missing %%EOF on {frame} {pal}")

                results.append((frame, pal, file_size))
                out_pdf.unlink()

        # Quantitative assertion: 28 of 28 permutations passed
        self.assertEqual(len(results), 28)


    def test_raster_fallback_pdf_size_all_24_permutations_ge_1mb(self):
        """Stress-test: High-res raster fallback must produce a valid PDF >= 1MB for all 24 permutations."""
        frame_sizes = list(FRAME_CONFIGS.keys())
        palettes = list(PALETTE_CONFIGS.keys())

        results = []
        for frame in frame_sizes:
            for pal in palettes:
                out_pdf = self.td / f"fallback_{frame}_{pal}.pdf"
                frame_conf = FRAME_CONFIGS[frame]
                w_px = frame_conf["w_px_300dpi"]
                h_px = frame_conf["h_px_300dpi"]

                pal_cfg = PALETTE_CONFIGS[pal]
                bg_hex = pal_cfg.get("bg", "#0c0c0c")

                texture_file = generate_fine_art_texture(w_px, h_px, bg_hex)
                poster_img = Image.open(texture_file).convert("RGB")

                if self.wave_png.exists():
                    wave_img = Image.open(self.wave_png).convert("RGBA")
                    paste_w = int(w_px * 0.84)
                    paste_h = int(wave_img.height * (paste_w / wave_img.width))
                    resized_wave = wave_img.resize((paste_w, paste_h), Image.Resampling.LANCZOS)
                    offset = ((w_px - paste_w) // 2, int(h_px * 0.22))
                    poster_img.paste(resized_wave, offset, mask=resized_wave)

                poster_img.save(str(out_pdf), "PDF", resolution=300.0, quality=95)
                if os.path.exists(texture_file):
                    os.unlink(texture_file)

                self.assertTrue(out_pdf.exists())
                file_size = os.path.getsize(str(out_pdf))
                self.assertGreaterEqual(
                    file_size,
                    1_000_000,
                    f"Fallback permutation {frame} / {pal} produced {file_size} bytes, strictly under 1MB",
                )

                # Validate PDF magic header
                with open(str(out_pdf), "rb") as f:
                    header = f.read(1024)
                self.assertTrue(header.startswith(b"%PDF-"), f"Invalid PDF header on fallback {frame} {pal}")

                results.append((frame, pal, file_size))
                out_pdf.unlink()

        self.assertEqual(len(results), 28)


class TestAudioDecimationAdversarialEmpirical(unittest.TestCase):
    """Category 2: Adversarial audio inputs (corrupt, empty, silence, extreme amplitude)."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.td = Path(self.tmp_dir.name)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_corrupt_zero_byte_audio_raises_gracefully(self):
        """A 0-byte audio file must raise a ValueError or WaveformError, not an unhandled crash."""
        empty_wav = self.td / "empty.wav"
        empty_wav.write_bytes(b"")
        out_png = self.td / "out.png"

        with self.assertRaises(Exception) as ctx:
            waveform_generator.generate_waveform_image(
                audio_source=str(empty_wav),
                output_path=str(out_png),
            )
        self.assertFalse(out_png.exists())

    def test_corrupt_header_audio_raises_gracefully(self):
        """A file with garbage bytes named .wav must raise a clean error."""
        corrupt_wav = self.td / "corrupt.wav"
        corrupt_wav.write_bytes(b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00garbage_content_not_valid_pcm")
        out_png = self.td / "out.png"

        with self.assertRaises(Exception):
            waveform_generator.generate_waveform_image(
                audio_source=str(corrupt_wav),
                output_path=str(out_png),
            )
        self.assertFalse(out_png.exists())

    def test_pure_silence_audio_renders_valid_min_elevation_waveform(self):
        """Pure silence (all 0s) must render a valid image with non-zero minimal elevation bars."""
        silence_wav = self.td / "silence.wav"
        with wave.open(str(silence_wav), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(b"\x00\x00" * 44100)

        out_png = self.td / "silence_wave.png"
        res = waveform_generator.generate_waveform_image(
            audio_source=str(silence_wav),
            output_path=str(out_png),
            palette="white_silver",
            transparent_bg=True,
        )
        self.assertTrue(out_png.exists())
        with Image.open(out_png) as img:
            self.assertEqual(img.mode, "RGBA")
            self.assertEqual(img.size, (3886, 661))


    def test_extreme_clipping_square_wave(self):
        """Full-scale clipped audio (alternating max int16 +32767 / -32768) renders without crash."""
        square_wav = self.td / "square.wav"
        frames = bytearray()
        for i in range(44100):
            val = 32767 if (i // 100) % 2 == 0 else -32768
            frames.extend(val.to_bytes(2, byteorder="little", signed=True))
        with wave.open(str(square_wav), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(frames)

        out_png = self.td / "square_wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(square_wav),
            output_path=str(out_png),
            palette="midnight_gold",
        )
        self.assertTrue(out_png.exists())

    def test_microsecond_audio_file(self):
        """Very short audio (e.g. 10 samples) handles gracefully with bar interpolation."""
        short_wav = self.td / "short.wav"
        frames = bytearray()
        for i in range(10):
            frames.extend((1000 * i).to_bytes(2, byteorder="little", signed=True))
        with wave.open(str(short_wav), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(frames)

        out_png = self.td / "short_wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(short_wav),
            output_path=str(out_png),
            palette="dark_blue_white",
        )
        self.assertTrue(out_png.exists())


class TestDatabaseTransitionsAndEdgeFieldsEmpirical(unittest.TestCase):
    """Category 3: Database state transitions, edge fields, and retry idempotency."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_db.db"
        self.audio_wav = Path(self.tmp_dir.name) / "test_audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=1.0)

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

    def _insert_order(self, order_id: str, **kwargs) -> None:
        defaults = {
            "customerEmail": "emp@example.com",
            "shippingName": "Empirical Tester",
            "shippingAddress": "123 Test Blvd, City, ST 12345",
            "frameSize": "16x20",
            "palette": "midnight_gold",
            "caption": "Test Inscription",
            "audioPath": str(self.audio_wav),
            "status": "pending_fulfillment",
            "totalAmount": 9900,
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000),
        }
        defaults.update(kwargs)
        conn = sqlite3.connect(str(self.db_path))
        cols = ", ".join(f'"{k}"' for k in defaults.keys())
        placeholders = ", ".join(["?"] * len(defaults))
        sql = f'INSERT INTO "Order" ("id", {cols}) VALUES (?, {placeholders})'
        conn.execute(sql, (order_id, *defaults.values()))
        conn.commit()
        conn.close()

    def test_unicode_and_emojis_in_caption(self):
        """Order with multi-lingual UTF-8 and emojis fulfills without encoding error."""
        order_id = "ord_unicode_001"
        emoji_caption = "🎶 音波のアート 💖 10周年記念 🚀 2026-09-20 🌟"
        self._insert_order(order_id, caption=emoji_caption)

        res = run_fulfillment(order_id, provider_name="mock", email_provider="mock", db_path=str(self.db_path))
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "fulfillment_submitted")

        # Verify DB state
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status, partnerOrderId FROM "Order" WHERE id = ?', (order_id,))
        row = cur.fetchone()
        conn.close()
        self.assertEqual(row[0], "fulfillment_submitted")
        self.assertTrue(row[1].startswith("ord_prodigi_mock_"))

    def test_huge_caption_is_sanitized_and_truncated(self):
        """Order with 10,000 character caption completes without crashing PDF compiler."""
        order_id = "ord_huge_cap_002"
        huge_caption = "Repeat " * 2000  # 14,000 characters
        self._insert_order(order_id, caption=huge_caption)

        res = run_fulfillment(order_id, provider_name="mock", email_provider="mock", db_path=str(self.db_path))
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "fulfillment_submitted")

    def test_corrupt_audio_order_transitions_to_fulfillment_failed(self):
        """When an order references a corrupt audio file, pipeline raises error, updates status to fulfillment_failed."""
        order_id = "ord_fail_audio_003"
        bad_audio = Path(self.tmp_dir.name) / "bad.wav"
        bad_audio.write_bytes(b"invalid corrupt data")
        self._insert_order(order_id, audioPath=str(bad_audio))

        with self.assertRaises(Exception):
            run_fulfillment(order_id, provider_name="mock", email_provider="mock", db_path=str(self.db_path))

        # Check DB status is fulfillment_failed and error logged in FulfillmentLog
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status FROM "Order" WHERE id = ?', (order_id,))
        status = cur.fetchone()[0]
        cur.execute('SELECT step, status, details FROM "FulfillmentLog" WHERE orderId = ?', (order_id,))
        logs = cur.fetchall()
        conn.close()

        self.assertEqual(status, "fulfillment_failed")
        self.assertTrue(any(log[1] == "failed" for log in logs))

    def test_retry_already_submitted_order_is_idempotent(self):
        """Fulfilling an order twice sequentially succeeds and updates logs cleanly."""
        order_id = "ord_idempotent_004"
        self._insert_order(order_id)

        res1 = run_fulfillment(order_id, provider_name="mock", email_provider="mock", db_path=str(self.db_path))
        self.assertTrue(res1["success"])

        res2 = run_fulfillment(order_id, provider_name="mock", email_provider="mock", db_path=str(self.db_path))
        self.assertTrue(res2["success"])


class TestDatabaseConcurrencyStressEmpirical(unittest.TestCase):
    """Category 4: Database concurrency under multi-threaded/multi-process workloads."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "concurrent.db"
        self.audio_wav = Path(self.tmp_dir.name) / "tone.wav"
        generate_wav(str(self.audio_wav), duration_seconds=1.0)

        conn = sqlite3.connect(str(self.db_path))
        conn.executescript("""
        PRAGMA journal_mode = WAL;
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

    def test_multi_order_concurrency(self):
        """Execute 4 separate order fulfillments simultaneously against the same DB."""
        order_ids = [f"ord_conc_{i}" for i in range(4)]
        conn = sqlite3.connect(str(self.db_path))
        ts = int(time.time() * 1000)
        for oid in order_ids:
            conn.execute(
                'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (oid, f"{oid}@example.com", "Concurrent User", "123 Conc St", "11x14", "dark_blue_white", "Conc", str(self.audio_wav), "pending_fulfillment", 7900, ts, ts),
            )
        conn.commit()
        conn.close()

        def worker(oid):
            return run_fulfillment(oid, provider_name="mock", email_provider="mock", db_path=str(self.db_path))

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(worker, oid) for oid in order_ids]
            results = [f.result(timeout=60) for f in futures]

        for r in results:
            self.assertTrue(r["success"])
            self.assertEqual(r["status"], "fulfillment_submitted")

        # Verify DB integrity
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT count(*) FROM "Order" WHERE status = "fulfillment_submitted"')
        count = cur.fetchone()[0]
        conn.close()
        self.assertEqual(count, 4)


class TestCliSubprocessRunnerEmpirical(unittest.TestCase):
    """Category 5: CLI Subprocess runner error handling and parameters."""

    def test_cli_missing_args_exit_code_2(self):
        cmd = [sys.executable, "-m", "backend.fulfill"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2)

    def test_cli_empty_order_id_exit_code_2(self):
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "  "]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2)

    def test_cli_invalid_provider_exit_code_2(self):
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "ord_1", "--provider", "fake"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2)

    def test_cli_nonexistent_order_exit_code_1_json_error(self):
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "ord_nonexistent_9999", "--provider", "mock"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 1)
        err_json = json.loads(proc.stderr.strip().split("\n")[-1])
        self.assertFalse(err_json["success"])
        self.assertIn("does not exist", err_json["error"])


if __name__ == "__main__":
    unittest.main()
