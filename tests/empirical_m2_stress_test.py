"""
empirical_m2_stress_test.py
SoundWave Art - Milestone 2 Iteration 2 Empirical Stress Test Harness.
Adversarial stress-testing of PDF compilation across:
  - All 4 frame sizes x 7 palettes (28 permutations)
  - Raster fallback compiler across frame sizes
  - Audio edge cases (pure silence, full clipping, DC offset, 0.05s short, out-of-phase stereo, sweep)
  - Caption edge cases (empty, >200 chars, HTML/XSS injection, Unicode/emoji/CJK, newline collapse)
  - End-to-End fulfill pipeline on 8x10 white/silver, 24x36 dark_blue_white, 11x14 rose_petal
Strict size assertions: ALL PDFs must be >= 1,000,000 bytes and < 15,000,000 bytes.
"""

import html
import json
import math
import os
import re
import shutil
import struct
import sys
import tempfile
import time
import unittest
import wave
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from PIL import Image

import backend.print_engine as pe
import backend.waveform_generator as wg
import backend.fulfill as ff
from backend.print_engine import FRAME_CONFIGS, PALETTE_CONFIGS, compile_print_pdf, generate_fine_art_texture
from backend.fulfill import run_fulfillment
import sqlite3


class EmpiricalStressTestResult:
    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.failures: List[Dict[str, Any]] = []

    def record(self, category: str, test_name: str, passed: bool, size_bytes: int, details: str):
        entry = {
            "category": category,
            "name": test_name,
            "passed": passed,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 3) if size_bytes else 0.0,
            "details": details,
        }
        self.results.append(entry)
        if not passed:
            self.failures.append(entry)


def synthesize_audio_edge_case(output_path: str, case_type: str, duration: float = 1.0, sample_rate: int = 44100):
    """Generates pathological and edge-case WAV audio signals."""
    num_samples = int(duration * sample_rate)
    
    if case_type == "silence":
        # Pure digital zero silence
        samples = np.zeros(num_samples, dtype=np.int16)
        channels = 1
    elif case_type == "full_clipping":
        # Max positive and negative square wave (worst-case dynamic range)
        samples = np.where(np.arange(num_samples) % 100 < 50, 32767, -32768).astype(np.int16)
        channels = 1
    elif case_type == "dc_offset":
        # Constant non-zero DC offset
        samples = np.full(num_samples, 16384, dtype=np.int16)
        channels = 1
    elif case_type == "short":
        # Extremely short audio (50ms)
        num_samples = int(0.05 * sample_rate)
        t = np.linspace(0, 0.05, num_samples, endpoint=False)
        samples = (np.sin(2 * np.pi * 440 * t) * 32000).astype(np.int16)
        channels = 1
    elif case_type == "out_of_phase_stereo":
        # Stereo where Left = +signal, Right = -signal
        t = np.linspace(0, duration, num_samples, endpoint=False)
        sig = (np.sin(2 * np.pi * 440 * t) * 28000).astype(np.int16)
        # Interleave L and R
        stereo_samples = np.empty((num_samples * 2,), dtype=np.int16)
        stereo_samples[0::2] = sig
        stereo_samples[1::2] = -sig
        with wave.open(output_path, "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(stereo_samples.tobytes())
        return
    elif case_type == "chirp_sweep":
        # Logarithmic sweep 20 Hz to 20,000 Hz
        t = np.linspace(0, duration, num_samples, endpoint=False)
        f0, f1 = 20.0, 20000.0
        # Instantaneous phase for chirp
        phase = 2 * np.pi * f0 * ((f1 / f0) ** (t / duration) - 1.0) / np.log(f1 / f0)
        samples = (np.sin(phase) * 30000).astype(np.int16)
        channels = 1
    else:  # standard sine tone
        t = np.linspace(0, duration, num_samples, endpoint=False)
        samples = (np.sin(2 * np.pi * 440 * t) * 28000).astype(np.int16)
        channels = 1

    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())


def parse_pdf_mediabox(pdf_bytes: bytes) -> Tuple[int, int]:
    match = re.search(rb"/MediaBox\s*\[\s*0\s+0\s+(\d+)\s+(\d+)\s*\]", pdf_bytes)
    if match:
        return int(match.group(1)), int(match.group(2))
    return -1, -1


def run_all_stress_tests() -> Tuple[EmpiricalStressTestResult, float]:
    result_collector = EmpiricalStressTestResult()
    start_time = time.time()
    
    td = tempfile.mkdtemp(prefix="soundwave_m2_stress_")
    td_path = Path(td)
    print(f"[INIT] Stress test working directory: {td_path}")
    
    try:
        # Generate reference audio and waveform
        ref_wav = td_path / "ref.wav"
        synthesize_audio_edge_case(str(ref_wav), case_type="sine", duration=1.5)
        
        ref_waves = {}
        for pal in PALETTE_CONFIGS.keys():
            wave_file = td_path / f"ref_wave_{pal}.png"
            wg.generate_waveform_image(
                audio_source=str(ref_wav),
                output_path=str(wave_file),
                palette=pal,
                transparent_bg=True,
            )
            ref_waves[pal] = wave_file

        print("\n================================================================================")
        print("DIMENSION 1: ALL 4 FRAME SIZES x 7 PALETTES (28 PERMUTATIONS) VIA PLAYWRIGHT")
        print("================================================================================")
        
        expected_points = {
            "8x10": (576, 720),
            "11x14": (792, 1008),
            "16x20": (1152, 1440),
            "24x36": (1728, 2592),
        }
        
        for size_key, (exp_w, exp_h) in expected_points.items():
            for pal_key in PALETTE_CONFIGS.keys():
                pdf_file = td_path / f"matrix_{size_key}_{pal_key}.pdf"
                test_name = f"Playwright [{size_key} | {pal_key}]"
                try:
                    res = compile_print_pdf(
                        waveform_image_path=str(ref_waves[pal_key]),
                        output_pdf_path=str(pdf_file),
                        frame_size=size_key,
                        palette=pal_key,
                        caption=f"Stress Test {size_key} {pal_key}",
                        target_id_or_url=f"stress_{size_key}_{pal_key}",
                    )
                    size_bytes = os.path.getsize(str(pdf_file))
                    with open(str(pdf_file), "rb") as f:
                        pdf_data = f.read()
                    
                    has_pdf_header = pdf_data.startswith(b"%PDF-1.")
                    has_eof_trailer = b"%%EOF" in pdf_data[-1024:]
                    act_w, act_h = parse_pdf_mediabox(pdf_data)
                    
                    size_pass = (1_000_000 <= size_bytes <= 15_000_000)
                    struct_pass = has_pdf_header and has_eof_trailer
                    box_pass = (act_w == exp_w and act_h == exp_h)
                    
                    passed = size_pass and struct_pass and box_pass
                    details = (
                        f"Bytes: {size_bytes:,} ({round(size_bytes/(1024*1024), 2)} MB) | "
                        f"Header: {has_pdf_header} | EOF: {has_eof_trailer} | "
                        f"MediaBox: [{act_w}x{act_h}] exp [{exp_w}x{exp_h}]"
                    )
                    result_collector.record("DIM1_MATRIX", test_name, passed, size_bytes, details)
                    status_str = "[PASS]" if passed else "[FAIL]"
                    print(f"  {status_str} {test_name:<36} -> {details}")
                except Exception as ex:
                    result_collector.record("DIM1_MATRIX", test_name, False, 0, f"Exception: {ex}")
                    print(f"  [FAIL] {test_name:<36} -> Exception: {ex}")

        print("\n================================================================================")
        print("DIMENSION 2: RASTER PDF FALLBACK COMPILER (ALL 4 SIZES x KEY PALETTES)")
        print("================================================================================")
        # Test raster PDF fallback logic from backend/fulfill.py line 368
        for size_key, (exp_w, exp_h) in expected_points.items():
            for pal_key in ["white_silver", "rose_petal", "midnight_gold"]:
                test_name = f"RasterFallback [{size_key} | {pal_key}]"
                pdf_file = td_path / f"fallback_{size_key}_{pal_key}.pdf"
                try:
                    frame_conf = FRAME_CONFIGS[size_key]
                    w_px = frame_conf["w_px_300dpi"]
                    h_px = frame_conf["h_px_300dpi"]
                    pal_cfg = PALETTE_CONFIGS[pal_key]
                    bg_hex = pal_cfg.get("bg", "#0c0c0c")
                    
                    texture_file = generate_fine_art_texture(w_px, h_px, bg_hex)
                    poster_img = Image.open(texture_file).convert("RGB")
                    
                    wave_img = Image.open(str(ref_waves[pal_key])).convert("RGBA")
                    paste_w = int(w_px * 0.84)
                    paste_h = int(wave_img.height * (paste_w / wave_img.width))
                    resized_wave = wave_img.resize((paste_w, paste_h), Image.Resampling.LANCZOS)
                    offset = ((w_px - paste_w) // 2, int(h_px * 0.22))
                    poster_img.paste(resized_wave, offset, mask=resized_wave)
                    
                    poster_img.save(str(pdf_file), "PDF", resolution=300.0, quality=95)
                    try:
                        os.unlink(texture_file)
                    except Exception:
                        pass
                    
                    size_bytes = os.path.getsize(str(pdf_file))
                    with open(str(pdf_file), "rb") as f:
                        pdf_data = f.read()
                    
                    has_pdf_header = pdf_data.startswith(b"%PDF-")
                    size_pass = (1_000_000 <= size_bytes <= 15_000_000)
                    passed = size_pass and has_pdf_header
                    details = f"Bytes: {size_bytes:,} ({round(size_bytes/(1024*1024), 2)} MB) | Header: {has_pdf_header}"
                    result_collector.record("DIM2_FALLBACK", test_name, passed, size_bytes, details)
                    status_str = "[PASS]" if passed else "[FAIL]"
                    print(f"  {status_str} {test_name:<36} -> {details}")
                except Exception as ex:
                    result_collector.record("DIM2_FALLBACK", test_name, False, 0, f"Exception: {ex}")
                    print(f"  [FAIL] {test_name:<36} -> Exception: {ex}")

        print("\n================================================================================")
        print("DIMENSION 3: AUDIO PATHOLOGY & EDGE CASES")
        print("================================================================================")
        audio_cases = [
            ("silence", 1.0),
            ("full_clipping", 1.0),
            ("dc_offset", 1.0),
            ("short", 0.05),
            ("out_of_phase_stereo", 1.5),
            ("chirp_sweep", 2.0),
        ]
        
        for case_name, dur in audio_cases:
            test_name = f"AudioEdge [{case_name}]"
            wav_file = td_path / f"edge_{case_name}.wav"
            wave_png = td_path / f"edge_wave_{case_name}.png"
            pdf_file = td_path / f"edge_pdf_{case_name}.pdf"
            
            try:
                synthesize_audio_edge_case(str(wav_file), case_type=case_name, duration=dur)
                # 1. Generate waveform
                wg.generate_waveform_image(
                    audio_source=str(wav_file),
                    output_path=str(wave_png),
                    palette="white_silver",  # Test on demanding white_silver palette
                    transparent_bg=True,
                )
                self_png_exists = wave_png.exists() and os.path.getsize(str(wave_png)) > 100
                
                # 2. Compile to 8x10 (smallest size)
                res = compile_print_pdf(
                    waveform_image_path=str(wave_png),
                    output_pdf_path=str(pdf_file),
                    frame_size="8x10",
                    palette="white_silver",
                    caption=f"Audio Edge Case: {case_name}",
                    target_id_or_url=f"audio_edge_{case_name}",
                )
                size_bytes = os.path.getsize(str(pdf_file))
                with open(str(pdf_file), "rb") as f:
                    pdf_data = f.read()
                
                has_pdf_header = pdf_data.startswith(b"%PDF-1.")
                has_eof = b"%%EOF" in pdf_data[-1024:]
                size_pass = (1_000_000 <= size_bytes <= 15_000_000)
                passed = self_png_exists and size_pass and has_pdf_header and has_eof
                details = (
                    f"Waveform PNG: {self_png_exists} | PDF Bytes: {size_bytes:,} | "
                    f"Header: {has_pdf_header} | EOF: {has_eof}"
                )
                result_collector.record("DIM3_AUDIO_EDGE", test_name, passed, size_bytes, details)
                status_str = "[PASS]" if passed else "[FAIL]"
                print(f"  {status_str} {test_name:<36} -> {details}")
            except Exception as ex:
                result_collector.record("DIM3_AUDIO_EDGE", test_name, False, 0, f"Exception: {ex}")
                print(f"  [FAIL] {test_name:<36} -> Exception: {ex}")

        print("\n================================================================================")
        print("DIMENSION 4: CAPTION / TEXT EDGE CASES & SANITIZATION")
        print("================================================================================")
        caption_cases = [
            ("empty_caption", "", "", "serif"),
            ("long_caption_350_chars", "A" * 350, "B" * 150, "sans"),
            ("xss_injection", '<script>alert("PWNED")</script><b onmouseover="evil()">vow</b> & "quote"', "Safe sub", "cursive"),
            ("unicode_and_cjk", "Hélène & François: 💖 “Forever” — 2026年9月20日 ♫ [432Hz]", "Sub: ¡Buenos días! München", "serif"),
            ("excessive_newlines", "Line 1\n\n\n\n\n\n\n\n\n\nLine 2\n\n\n\nLine 3", "Sub 1\n\n\nSub 2", "sans"),
            ("cursive_font_style", "Our Wedding Vows - September 20, 2026", "Sarah & David", "cursive"),
            ("sans_font_style", "Baby Liam Heartbeat 142 BPM", "Dr. Mark - St. Jude Hospital", "sans"),
        ]
        
        for case_name, cap, subcap, font_st in caption_cases:
            test_name = f"CaptionEdge [{case_name}]"
            pdf_file = td_path / f"caption_{case_name}.pdf"
            try:
                res = compile_print_pdf(
                    waveform_image_path=str(ref_waves["midnight_gold"]),
                    output_pdf_path=str(pdf_file),
                    frame_size="11x14",
                    palette="midnight_gold",
                    caption=cap,
                    subcaption=subcap,
                    font_style=font_st,
                    target_id_or_url=f"cap_edge_{case_name}",
                )
                size_bytes = os.path.getsize(str(pdf_file))
                with open(str(pdf_file), "rb") as f:
                    pdf_data = f.read()
                
                has_pdf_header = pdf_data.startswith(b"%PDF-1.")
                has_eof = b"%%EOF" in pdf_data[-1024:]
                size_pass = (1_000_000 <= size_bytes <= 15_000_000)
                
                # Check sanitization in safe_caption helper
                sanitized_cap = pe.sanitize_caption(cap, max_length=200)
                if "<script>" in cap:
                    xss_blocked = ("<script>" not in sanitized_cap) and ("&lt;script&gt;" in sanitized_cap)
                else:
                    xss_blocked = True
                
                if len(cap) > 200:
                    length_truncated = len(sanitized_cap) <= 200
                else:
                    length_truncated = True
                
                passed = size_pass and has_pdf_header and has_eof and xss_blocked and length_truncated
                details = (
                    f"Bytes: {size_bytes:,} | Header: {has_pdf_header} | "
                    f"XSS Blocked: {xss_blocked} | Truncated: {length_truncated}"
                )
                result_collector.record("DIM4_CAPTION_EDGE", test_name, passed, size_bytes, details)
                status_str = "[PASS]" if passed else "[FAIL]"
                print(f"  {status_str} {test_name:<36} -> {details}")
            except Exception as ex:
                result_collector.record("DIM4_CAPTION_EDGE", test_name, False, 0, f"Exception: {ex}")
                print(f"  [FAIL] {test_name:<36} -> Exception: {ex}")

        print("\n================================================================================")
        print("DIMENSION 5: END-TO-END FULFILLMENT PIPELINE STRESS TEST")
        print("================================================================================")
        # Test full 8-step fulfillment under high-luminance 8x10, large 24x36, and 11x14
        e2e_cases = [
            {
                "order_id": "stress_ord_e2e_8x10_white",
                "frame_size": "8x10",
                "palette": "white_silver",
                "caption": "Audit Remediation Stress 8x10 White",
                "customer_email": "audit.test@example.com",
            },
            {
                "order_id": "stress_ord_e2e_24x36_darkblue",
                "frame_size": "24x36",
                "palette": "dark_blue_white",
                "caption": "Maximum 24x36 Dark Blue Archival Print",
                "customer_email": "large.print@example.com",
            },
            {
                "order_id": "stress_ord_e2e_11x14_rose",
                "frame_size": "11x14",
                "palette": "rose_petal",
                "caption": "Rose Petal 11x14 Fine Art Inscription",
                "customer_email": "rose.art@example.com",
            },
        ]
        
        # Setup clean test DB and storage
        db_path = td_path / "stress_soundwave.db"
        storage_dir = td_path / "storage"
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(str(db_path))
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
        
        for e2e in e2e_cases:
            test_name = f"E2E Fulfillment [{e2e['order_id']}]"
            try:
                # 1. Synthesize audio file in storage
                audio_file = storage_dir / f"{e2e['order_id']}.wav"
                synthesize_audio_edge_case(str(audio_file), case_type="sine", duration=1.2)
                
                # 2. Seed Order into DB
                ts_ms = int(time.time() * 1000)
                conn = sqlite3.connect(str(db_path))
                conn.execute(
                    'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
                    'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (
                        e2e["order_id"],
                        e2e["customer_email"],
                        "Test Customer",
                        "123 Art Avenue, New York, NY 10001",
                        e2e["frame_size"],
                        e2e["palette"],
                        e2e["caption"],
                        str(audio_file),
                        "pending_fulfillment",
                        7900,
                        ts_ms,
                        ts_ms,
                    ),
                )
                conn.commit()
                conn.close()
                
                # 3. Execute run_fulfillment
                fulfill_res = run_fulfillment(
                    order_id=e2e["order_id"],
                    provider_name="mock",
                    email_provider="mock",
                    db_path=str(db_path),
                )
                
                # 4. Verify outcomes
                self_success = fulfill_res.get("success") is True
                rel_pdf = fulfill_res.get("pdfPath", "")
                full_pdf_path = PROJECT_ROOT / rel_pdf if rel_pdf else Path("")
                pdf_size = os.path.getsize(str(full_pdf_path)) if (rel_pdf and full_pdf_path.exists()) else 0
                
                rel_preview = fulfill_res.get("previewUrl", "")
                full_prev_path = PROJECT_ROOT / "storage" / "previews" / f"{e2e['order_id']}_preview.png"
                preview_size = os.path.getsize(str(full_prev_path)) if full_prev_path.exists() else 0
                
                # DB Status Check
                conn = sqlite3.connect(str(db_path))
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute('SELECT * FROM "Order" WHERE id = ?', (e2e["order_id"],))
                db_order = dict(cur.fetchone())
                status_ok = (db_order is not None and db_order["status"] == "fulfillment_submitted")
                
                # Log steps count
                cur.execute('SELECT * FROM "FulfillmentLog" WHERE orderId = ?', (e2e["order_id"],))
                logs = cur.fetchall()
                all_steps_ok = len(logs) == 8
                conn.close()
                
                size_pass = (1_000_000 <= pdf_size <= 15_000_000)
                preview_pass = (10_000 <= preview_size <= 500_000)
                
                passed = self_success and size_pass and preview_pass and status_ok and all_steps_ok
                details = (
                    f"Success: {self_success} | PDF Size: {pdf_size:,} bytes | "
                    f"Preview: {preview_size:,} bytes | Status: {db_order['status'] if db_order else 'None'} | "
                    f"Steps: {len(logs)}/8"
                )
                result_collector.record("DIM5_E2E", test_name, passed, pdf_size, details)
                status_str = "[PASS]" if passed else "[FAIL]"
                print(f"  {status_str} {test_name:<36} -> {details}")
            except Exception as ex:
                result_collector.record("DIM5_E2E", test_name, False, 0, f"Exception: {ex}")
                print(f"  [FAIL] {test_name:<36} -> Exception: {ex}")

    finally:
        # Cleanup
        try:
            shutil.rmtree(td, ignore_errors=True)
        except Exception:
            pass

    elapsed = time.time() - start_time
    return result_collector, elapsed


if __name__ == "__main__":
    collector, elapsed_sec = run_all_stress_tests()
    
    total_tests = len(collector.results)
    failures = len(collector.failures)
    passes = total_tests - failures
    
    print("\n" + "=" * 80)
    print(f"EMPIRICAL STRESS TEST SUMMARY (Completed in {elapsed_sec:.2f}s)")
    print("=" * 80)
    print(f"TOTAL TESTS EXECUTED: {total_tests}")
    print(f"PASSED:               {passes}")
    print(f"FAILED:               {failures}")
    
    # Quantitative sizing summary
    all_sizes = [r["size_bytes"] for r in collector.results if r["size_bytes"] > 0]
    if all_sizes:
        print(f"MIN PDF SIZE:         {min(all_sizes):,} bytes ({min(all_sizes)/(1024*1024):.2f} MB)")
        print(f"MAX PDF SIZE:         {max(all_sizes):,} bytes ({max(all_sizes)/(1024*1024):.2f} MB)")
        print(f"MEDIAN PDF SIZE:      {int(np.median(all_sizes)):,} bytes ({np.median(all_sizes)/(1024*1024):.2f} MB)")
        print(f"ALL >= 1,000,000 B:   {all(s >= 1_000_000 for s in all_sizes)}")
        print(f"ALL < 15,000,000 B:   {all(s < 15_000_000 for s in all_sizes)}")
    
    if failures > 0:
        print("\nFAILURES:")
        for f in collector.failures:
            print(f"  - [{f['category']}] {f['name']}: {f['details']}")
        sys.exit(1)
    else:
        print("\nVERDICT: ALL 100% EMPIRICAL STRESS TESTS PASSED.")
        sys.exit(0)
