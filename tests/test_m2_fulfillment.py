"""
SoundWave Art - Milestone 2 Full Fulfillment Engine Test Suite.
Verifies end-to-end:
  1. Waveform Generation & Audio Decimation
  2. Playwright 300 DPI Print PDF Generation (>= 1MB)
  3. Fast 800px Preview Thumbnail Generator (< 500KB)
  4. Print Partner Client & Mock Fulfillment Engine
  5. Transactional Email Service (< 60s SLA & Mock Queue)
  6. End-to-End Orchestrator Pipeline (8 Audited Steps & DB Updates)
  7. CLI Fulfillment Runner & Subprocess Exit Codes
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import (
    email_service,
    preview_generator,
    print_engine,
    print_partner,
    waveform_generator,
)
from backend.fulfill import PIPELINE_STEPS, run_fulfillment
from tests.test_harness import (
    FRAME_SIZES,
    PALETTES,
    generate_silent_wav,
    generate_wav,
    invoke_fulfillment_cli,
)


class TestWaveformGeneratorM2(unittest.TestCase):
    """Tests waveform peak extraction and discrete pill-bar rendering."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.audio_wav = Path(self.tmp_dir.name) / "test_sine.wav"
        generate_wav(str(self.audio_wav), duration_seconds=2.0, frequency=440.0)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_discrete_pill_bars_dimensions_and_alpha(self):
        out_png = Path(self.tmp_dir.name) / "wave_pill.png"
        cfg = waveform_generator.WaveformConfig(
            width=2400,
            height=600,
            style="pill_bars",
            num_bars=60,
            palette="midnight_gold",
            transparent_bg=True,
        )
        waveform_generator.generate_waveform_image(
            audio_source=str(self.audio_wav),
            output_path=str(out_png),
            config=cfg,
        )

        self.assertTrue(out_png.exists())
        with Image.open(out_png) as img:
            self.assertEqual(img.size, (2400, 600))
            self.assertEqual(img.mode, "RGBA")

    def test_silent_audio_does_not_crash(self):
        silent_wav = Path(self.tmp_dir.name) / "silent.wav"
        generate_silent_wav(str(silent_wav), duration_seconds=1.5)
        out_png = Path(self.tmp_dir.name) / "silent_wave.png"

        waveform_generator.generate_waveform_image(
            audio_source=str(silent_wav),
            output_path=str(out_png),
            palette="white_silver",
            transparent_bg=True,
        )
        self.assertTrue(out_png.exists())
        with Image.open(out_png) as img:
            self.assertEqual(img.mode, "RGBA")


class TestPrintEngineM2(unittest.TestCase):
    """Tests 300 DPI print-ready PDF compilation and >= 1MB file size requirement."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.audio_wav = Path(self.tmp_dir.name) / "test_audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=2.0)
        self.wave_png = Path(self.tmp_dir.name) / "wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(self.audio_wav),
            output_path=str(self.wave_png),
            palette="midnight_gold",
            transparent_bg=True,
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_compile_print_pdf_ge_1mb_and_valid_header(self):
        out_pdf = Path(self.tmp_dir.name) / "print_16x20.pdf"
        result = print_engine.compile_print_pdf(
            waveform_image_path=str(self.wave_png),
            output_pdf_path=str(out_pdf),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Our First Dance — September 20, 2025",
            target_id_or_url="ord_test_playwright",
        )

        self.assertTrue(result["success"])
        self.assertTrue(out_pdf.exists())
        file_size = os.path.getsize(out_pdf)
        self.assertGreaterEqual(
            file_size,
            1_000_000,
            f"PDF file size {file_size} is below 1,000,000 bytes",
        )
        with open(out_pdf, "rb") as f:
            header = f.read(1024)
            self.assertTrue(header.startswith(b"%PDF-"))

    def test_qr_code_generation(self):
        qr_file = Path(self.tmp_dir.name) / "qr.png"
        res_path = print_engine.generate_qr_code(
            target_id_or_url="audio_sample_77",
            output_path=str(qr_file),
        )
        self.assertTrue(Path(res_path).exists())
        with Image.open(res_path) as img:
            self.assertGreaterEqual(img.width, 200)
            self.assertGreaterEqual(img.height, 200)


class TestPreviewGeneratorM2(unittest.TestCase):
    """Tests fast 800px preview thumbnail generator."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.audio_wav = Path(self.tmp_dir.name) / "test_audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=1.5)
        self.wave_png = Path(self.tmp_dir.name) / "wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(self.audio_wav),
            output_path=str(self.wave_png),
            palette="ocean_navy",
            transparent_bg=True,
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_preview_dimensions_aspect_ratio_and_file_size(self):
        test_cases = [
            ("8x10", (640, 800)),
            ("11x14", (628, 800)),
            ("16x20", (640, 800)),
            ("24x36", (533, 800)),
        ]
        for frame, expected_dims in test_cases:
            out_img = Path(self.tmp_dir.name) / f"preview_{frame}.png"
            preview_generator.generate_preview_thumbnail(
                output_path=str(out_img),
                waveform_image_path=str(self.wave_png),
                frame_size=frame,
                palette="dark_blue_white",
                caption="Testing Aspect Ratio",
                target_id_or_url="ord_preview_test",
            )
            self.assertTrue(out_img.exists())
            file_size = os.path.getsize(out_img)
            self.assertLess(
                file_size,
                500_000,
                f"Preview image size {file_size} exceeds 500 KB limit",
            )
            with Image.open(out_img) as img:
                self.assertEqual(img.size, expected_dims)
                self.assertLessEqual(max(img.size), 800)


class TestPrintPartnerM2(unittest.TestCase):
    """Tests Print Partner REST client and Mock fulfillment provider."""

    def setUp(self):
        print_partner.MockFulfillmentProvider.clear()

    def test_mock_fulfillment_provider_order_creation_and_retrieval(self):
        provider = print_partner.get_fulfillment_provider("mock")
        recipient = print_partner.Recipient(
            name="Alice Smith",
            email="alice@example.com",
            address=print_partner.RecipientAddress(
                line1="123 Art Lane",
                city="Portland",
                state_or_county="OR",
                postal_or_zip_code="97201",
                country_code="US",
            ),
        )
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_test_m2_001",
            recipient=recipient,
            items=[
                print_partner.FulfillmentItem(
                    sku="GLOBAL-CFP-16X20",
                    copies=1,
                    assets=[{"printArea": "default", "url": "https://example.com/print.pdf"}],
                )
            ],
        )

        resp = provider.create_order(req)
        self.assertTrue(resp.success)
        self.assertEqual(resp.outcome, "Created")
        self.assertIsNotNone(resp.partner_order_id)
        self.assertTrue(resp.partner_order_id.startswith("ord_prodigi_mock_"))

        # Query status
        status_resp = provider.get_order_status(resp.partner_order_id)
        self.assertTrue(status_resp.success)
        self.assertEqual(status_resp.stage, "InProgress")
        self.assertGreater(len(status_resp.shipments), 0)

        # Cancel
        cancelled = provider.cancel_order(resp.partner_order_id)
        self.assertTrue(cancelled)

    def test_mock_fulfillment_simulated_failures(self):
        provider = print_partner.get_fulfillment_provider("mock")
        recipient = print_partner.Recipient(
            name="Bob SIMULATE_FAIL",
            email="bob@example.com",
            address=print_partner.RecipientAddress(
                line1="123 Main St",
                city="Dallas",
                country_code="US",
            ),
        )
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_fail_001",
            recipient=recipient,
            items=[
                print_partner.FulfillmentItem(
                    sku="GLOBAL-CFP-16X20",
                    copies=1,
                )
            ],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertGreater(len(resp.errors), 0)


class TestEmailServiceM2(unittest.TestCase):
    """Tests Transactional Email Service and Mock queue."""

    def setUp(self):
        email_service.MockEmailService.clear_sent_emails()

    def test_mock_email_dispatch_and_inspection(self):
        svc = email_service.get_email_service("mock")
        data = email_service.OrderConfirmationData(
            order_id="ord_email_test_101",
            customer_email="customer@example.com",
            customer_name="John Doe",
            frame_size_label='16" × 20" Framed Print',
            palette_name="Midnight Gold",
            total_formatted="$99.00",
            caption="Our Song",
            order_number=1055,
        )

        res = svc.send_order_confirmation(data)
        self.assertTrue(res["success"])
        self.assertIn("sent_at", res)

        sent = email_service.MockEmailService.get_sent_emails()
        self.assertEqual(len(sent), 1)
        latest = email_service.MockEmailService.get_latest_email_for("customer@example.com")
        self.assertIsNotNone(latest)
        self.assertEqual(latest["orderId"], "ord_email_test_101")
        self.assertIn("Your SoundWave Art order is confirmed! (#1055)", latest["subject"])
        self.assertIn("/order/ord_email_test_101", latest["html"])


class TestFulfillmentPipelineM2(unittest.TestCase):
    """End-to-End automated fulfillment pipeline tests against SQLite DB."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_soundwave.db"

        # Initialize SQLite DB matching Prisma schema
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

        # Generate a test audio file
        self.audio_wav = Path(self.tmp_dir.name) / "order_audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=2.0)

        # Seed test order
        self.order_id = "test_ord_m2_e2e_99"
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                self.order_id,
                "sarah.jenkins@example.com",
                "Sarah Jenkins",
                "742 Evergreen Terrace, Springfield, OR 97477",
                "16x20",
                "midnight_gold",
                "Our First Dance — October 14, 2024",
                str(self.audio_wav),
                "pending_fulfillment",
                9900,
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

    def test_e2e_pipeline_orchestration_and_db_updates(self):
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

        # Verify database record
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute('SELECT * FROM "Order" WHERE id = ?', (self.order_id,))
        order_row = dict(cur.fetchone())
        self.assertEqual(order_row["status"], "fulfillment_submitted")
        self.assertEqual(order_row["partnerOrderId"], summary["partnerOrderId"])
        self.assertIsNotNone(order_row["printPdfPath"])
        self.assertIsNotNone(order_row["previewUrl"])

        # Verify audit logs
        cur.execute('SELECT * FROM "FulfillmentLog" WHERE orderId = ? ORDER BY timestamp ASC', (self.order_id,))
        logs = [dict(r) for r in cur.fetchall()]
        conn.close()

        logged_steps = [lg["step"] for lg in logs]
        for step in PIPELINE_STEPS:
            self.assertIn(step, logged_steps)

        # Verify email sent
        sent = email_service.MockEmailService.get_sent_emails()
        self.assertGreaterEqual(len(sent), 1)
        self.assertEqual(sent[-1]["orderId"], self.order_id)

    def test_cli_runner_subprocess_execution(self):
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
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )

        self.assertEqual(proc.returncode, 0, f"CLI runner failed: {proc.stderr}")
        data = json.loads(proc.stdout)
        self.assertTrue(data["success"])
        self.assertEqual(data["status"], "fulfillment_submitted")
        self.assertTrue(data["partnerOrderId"].startswith("ord_prodigi_mock_"))


if __name__ == "__main__":
    unittest.main()
