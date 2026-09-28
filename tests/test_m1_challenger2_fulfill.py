"""
Empirical Challenger M1_2 Test Suite: Python Fulfillment & Playwright PDF Engine
Tests backend/fulfill.py and backend/print_engine.py with DATABASE_URL set to PostgreSQL.
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Force DATABASE_URL to PostgreSQL Supabase URL
POSTGRES_TEST_URL = "postgresql://postgres.drxbenpmmgthwawdntyq:VigilWatchCloud2@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
os.environ["DATABASE_URL"] = POSTGRES_TEST_URL

from backend import (
    email_service,
    preview_generator,
    print_engine,
    print_partner,
    waveform_generator,
)
from backend.fulfill import PIPELINE_STEPS, get_db_connection, run_fulfillment
from tests.test_harness import generate_wav


class TestPlaywrightAndFulfillUnderPostgres(unittest.TestCase):
    """Verifies backend/fulfill.py and Playwright PDF generation when DATABASE_URL is PostgreSQL."""

    def setUp(self):
        os.environ["DATABASE_URL"] = POSTGRES_TEST_URL
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.audio_wav = Path(self.tmp_dir.name) / "test_sine.wav"
        generate_wav(str(self.audio_wav), duration_seconds=2.0, frequency=440.0)

        # Setup local SQLite test database
        self.local_db = Path(self.tmp_dir.name) / "local_soundwave.db"
        conn = sqlite3.connect(str(self.local_db))
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
            photoPath TEXT,
            decorativeTheme TEXT DEFAULT 'botanical',
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

        print_partner.MockFulfillmentProvider.clear()
        email_service.MockEmailService.clear_sent_emails()

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_01_get_db_connection_fallback_under_postgres_env(self):
        """Test that get_db_connection ignores PostgreSQL DATABASE_URL and connects to SQLite."""
        # 1. Without custom path, it should fallback to local storage/soundwave.db or prisma/dev.db
        conn = get_db_connection()
        self.assertIsInstance(conn, sqlite3.Connection)
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        self.assertEqual(cur.fetchone()[0], 1)
        conn.close()

        # 2. With custom path pointing to temporary SQLite DB
        conn_custom = get_db_connection(str(self.local_db))
        self.assertIsInstance(conn_custom, sqlite3.Connection)
        cur_custom = conn_custom.cursor()
        cur_custom.execute('SELECT count(*) FROM "Order";')
        self.assertEqual(cur_custom.fetchone()[0], 0)
        conn_custom.close()

    def test_02_playwright_direct_pdf_compilation(self):
        """Test Playwright PDF generation directly without path errors."""
        wave_png = Path(self.tmp_dir.name) / "test_wave.png"
        waveform_generator.generate_waveform_image(
            audio_source=str(self.audio_wav),
            output_path=str(wave_png),
            palette="midnight_gold",
            frame_size="16x20",
            transparent_bg=True,
        )
        self.assertTrue(wave_png.exists())

        out_pdf = Path(self.tmp_dir.name) / "test_output.pdf"
        out_preview = Path(self.tmp_dir.name) / "test_thumb.jpg"

        result = print_engine.compile_print_pdf(
            waveform_image_path=str(wave_png),
            output_pdf_path=str(out_pdf),
            frame_size="16x20",
            palette="midnight_gold",
            caption="Direct Playwright Test — September 2026",
            target_id_or_url="ord_synth_001",
            preview_output_path=str(out_preview),
        )

        self.assertTrue(result["success"])
        self.assertTrue(out_pdf.exists())
        self.assertTrue(out_preview.exists())

        # Verify PDF size >= 1MB
        pdf_size = os.path.getsize(out_pdf)
        self.assertGreaterEqual(pdf_size, 1_000_000, f"PDF size {pdf_size} < 1,000,000 bytes")

        # Verify valid PDF header
        with open(out_pdf, "rb") as f:
            header = f.read(1024)
            self.assertTrue(header.startswith(b"%PDF-"))

    def test_03_run_fulfillment_e2e_with_synthetic_order(self):
        """Test complete 8-step fulfillment pipeline on synthetic order in local SQLite with DATABASE_URL=postgres."""
        synth_order_id = f"ord_synth_e2e_{int(time.time())}"
        ts_ms = int(time.time() * 1000)

        conn = sqlite3.connect(str(self.local_db))
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                synth_order_id,
                "challenger_test@example.com",
                "Jane Doe",
                "123 Acoustic Way, Austin, TX 78701",
                "16x20",
                "midnight_gold",
                "Our Journey — 2026",
                str(self.audio_wav),
                "pending_fulfillment",
                9900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

        summary = run_fulfillment(
            order_id=synth_order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.local_db),
        )

        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")
        self.assertTrue(summary["partnerOrderId"].startswith("ord_prodigi_mock_"))
        self.assertGreaterEqual(summary["pdfSizeBytes"], 1_000_000)
        self.assertEqual(summary["steps"], PIPELINE_STEPS)

        # Verify DB mutations in local DB
        conn = sqlite3.connect(str(self.local_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT * FROM "Order" WHERE id = ?', (synth_order_id,))
        row = dict(cur.fetchone())
        self.assertEqual(row["status"], "fulfillment_submitted")
        self.assertEqual(row["partnerOrderId"], summary["partnerOrderId"])
        self.assertTrue(row["printPdfPath"].startswith("storage/print_pdfs/"))
        self.assertTrue(row["previewUrl"].startswith("/api/orders/"))

        # Verify fulfillment logs
        cur.execute('SELECT * FROM "FulfillmentLog" WHERE orderId = ? ORDER BY timestamp ASC', (synth_order_id,))
        logs = [dict(r) for r in cur.fetchall()]
        conn.close()

        logged_steps = [l["step"] for l in logs]
        for step in PIPELINE_STEPS:
            self.assertIn(step, logged_steps)

    def test_04_cli_subprocess_under_postgres_env(self):
        """Test invoking python -m backend.fulfill via CLI subprocess with DATABASE_URL=postgres."""
        synth_cli_order_id = f"ord_synth_cli_{int(time.time())}"
        ts_ms = int(time.time() * 1000)

        conn = sqlite3.connect(str(self.local_db))
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                synth_cli_order_id,
                "cli_test@example.com",
                "Bob CLI",
                "456 Runner Blvd, Seattle, WA 98101",
                "11x14",
                "ocean_navy",
                "SoundWave Art CLI Verification",
                str(self.audio_wav),
                "pending_fulfillment",
                6900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

        env = os.environ.copy()
        env["DATABASE_URL"] = POSTGRES_TEST_URL

        cmd = [
            sys.executable,
            "-m",
            "backend.fulfill",
            "--order-id",
            synth_cli_order_id,
            "--provider",
            "mock",
            "--email-provider",
            "mock",
            "--db",
            str(self.local_db),
        ]

        proc = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )

        self.assertEqual(proc.returncode, 0, f"CLI runner failed: {proc.stderr}")
        data = json.loads(proc.stdout)
        self.assertTrue(data["success"])
        self.assertEqual(data["status"], "fulfillment_submitted")
        self.assertGreaterEqual(data["pdfSizeBytes"], 1_000_000)


if __name__ == "__main__":
    unittest.main()
