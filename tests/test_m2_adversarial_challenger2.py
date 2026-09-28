"""
tests/test_m2_adversarial_challenger2.py
Milestone 2 Challenger 2 - Adversarial Stress & Corner-Case Harness for SoundWave Art.

Empirical verification of:
  1. CLI Runner Parameter Validation (invalid IDs, missing flags, nonexistent DB records, SQL injection, path traversal, error codes)
  2. Database State Transitions & Schema Integrity (pending -> submitted, failure transitions, audit log sequence, unicode, long text)
  3. Concurrency & Idempotency (sequential double fulfillment, parallel same-order execution, multi-order concurrency under WAL)
  4. Transactional Email Service & SLA (metadata verification, HTML/text rendering, <60s SLA compliance, disk persistence)
  5. Print Partner Integration Edge & Negative Scenarios (Prodigi, Printify, Mock fallbacks, validation guards, cancellation)
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
from typing import Any, Dict, List, Optional, Tuple
import unittest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import email_service, preview_generator, print_engine, print_partner, waveform_generator
from backend.fulfill import PIPELINE_STEPS, run_fulfillment
from tests.test_harness import FRAME_SIZES, PALETTES, generate_wav


class TestCliParameterValidationAdversarial(unittest.TestCase):
    """Category 1: Adversarial tests for CLI runner parameter validation & error codes."""

    def test_cli_missing_all_arguments_exit_code_2(self):
        """CLI without arguments must exit with code 2."""
        cmd = [sys.executable, "-m", "backend.fulfill"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2, f"Expected exit code 2 on missing args, got {proc.returncode}")

    def test_cli_empty_order_id_exit_code_2(self):
        """CLI with empty --order-id must exit with code 2."""
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", ""]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2, f"Expected exit code 2 on empty string, got {proc.returncode}")

    def test_cli_whitespace_order_id_exit_code_2(self):
        """CLI with whitespace-only --order-id must exit with code 2."""
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "   \t\n  "]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2, f"Expected exit code 2 on whitespace string, got {proc.returncode}")

    def test_cli_invalid_provider_choice_exit_code_2(self):
        """CLI with unrecognized --provider must exit with code 2 (argparse choice validation)."""
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "ord_123", "--provider", "bogus_provider"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2, f"Expected exit code 2 on invalid provider, got {proc.returncode}")

    def test_cli_invalid_email_provider_choice_exit_code_2(self):
        """CLI with unrecognized --email-provider must exit with code 2."""
        cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", "ord_123", "--email-provider", "bogus_email"]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 2, f"Expected exit code 2 on invalid email provider, got {proc.returncode}")

    def test_cli_nonexistent_order_id_exit_code_1_with_error_json(self):
        """CLI with nonexistent order ID must exit with code 1 and output JSON error."""
        cmd = [
            sys.executable,
            "-m",
            "backend.fulfill",
            "--order-id",
            "ord_completely_nonexistent_999999",
            "--provider",
            "mock",
        ]
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
        self.assertEqual(proc.returncode, 1, f"Expected exit code 1 on missing DB record, got {proc.returncode}")
        # stderr must contain JSON error
        try:
            err_data = json.loads(proc.stderr.strip().split("\n")[-1])
            self.assertFalse(err_data.get("success", True))
            self.assertIn("does not exist", err_data.get("error", ""))
        except Exception:
            # Check if json was in stdout or stderr
            combined = proc.stdout + proc.stderr
            self.assertIn("does not exist", combined)

    def test_cli_sql_injection_attempt_in_order_id(self):
        """Adversarial SQL injection strings must not execute arbitrary SQL or crash DB."""
        malicious_ids = [
            "'; DROP TABLE \"Order\"; --",
            "' OR '1'='1",
            "test' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16 --",
            "1; SELECT pg_sleep(5);",
        ]
        for injection in malicious_ids:
            cmd = [
                sys.executable,
                "-m",
                "backend.fulfill",
                "--order-id",
                injection,
                "--provider",
                "mock",
            ]
            proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
            self.assertEqual(proc.returncode, 1, f"SQL injection string {injection} should exit with code 1")

    def test_cli_path_traversal_attempt_in_order_id(self):
        """Adversarial path traversal in order_id must not crash the runner or escape directories."""
        traversal_ids = [
            "../../etc/passwd",
            "..\\..\\windows\\system32\\cmd.exe",
            "../../../secret_token",
        ]
        for tid in traversal_ids:
            cmd = [
                sys.executable,
                "-m",
                "backend.fulfill",
                "--order-id",
                tid,
                "--provider",
                "mock",
            ]
            proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=15)
            self.assertEqual(proc.returncode, 1, f"Path traversal string {tid} should safely exit with 1")


class TestDatabaseStateTransitionsAdversarial(unittest.TestCase):
    """Category 2: Database state transitions, failure recovery, schema versatility, and edge fields."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_state.db"
        self.audio_wav = Path(self.tmp_dir.name) / "sample_audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=1.0)

        # Initialize Prisma-style database
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
        conn.commit()
        conn.close()

    def tearDown(self):
        self.tmp_dir.cleanup()

    def _insert_order(
        self,
        order_id: str,
        status: str = "pending_fulfillment",
        customer_name: str = "Jane Tester",
        customer_email: str = "jane@example.com",
        shipping_address: str = "123 Main St, Seattle, WA 98101",
        frame_size: str = "11x14",
        palette: str = "white_silver",
        caption: str = "Test Caption",
        audio_path: Optional[str] = None,
    ) -> None:
        conn = sqlite3.connect(str(self.db_path))
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                order_id,
                customer_email,
                customer_name,
                shipping_address,
                frame_size,
                palette,
                caption,
                audio_path or str(self.audio_wav),
                status,
                6900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

    def test_successful_state_transition_and_audit_log_chain(self):
        """Verifies state strictly transitions to fulfillment_submitted with all fields and 8 logs."""
        order_id = "ord_adv_trans_01"
        self._insert_order(order_id, status="pending_fulfillment")

        summary = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )

        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")

        # Verify DB state directly
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT * FROM "Order" WHERE id = ?', (order_id,))
        row = dict(cur.fetchone())

        self.assertEqual(row["status"], "fulfillment_submitted")
        self.assertTrue(row["partnerOrderId"].startswith("ord_prodigi_mock_"))
        self.assertTrue(row["printPdfPath"].startswith("storage/print_pdfs/"))
        self.assertTrue(row["previewUrl"].startswith("/api/orders/"))
        self.assertGreaterEqual(row["updatedAt"], row["createdAt"])

        # Check all 8 steps in audit logs in order
        cur.execute('SELECT step, status, timestamp FROM "FulfillmentLog" WHERE orderId = ? ORDER BY timestamp ASC', (order_id,))
        logs = [dict(r) for r in cur.fetchall()]
        conn.close()

        step_names = [lg["step"] for lg in logs]
        for expected_step in PIPELINE_STEPS:
            self.assertIn(expected_step, step_names)
            # Ensure every step status was 'completed'
            step_log = next(lg for lg in logs if lg["step"] == expected_step)
            self.assertEqual(step_log["status"], "completed")

    def test_partner_failure_triggers_fulfillment_failed_state(self):
        """When print partner rejects the order, DB status must transition to fulfillment_failed."""
        order_id = "ord_adv_fail_02"
        # Using SIMULATE_FAIL in name triggers mock rejection
        self._insert_order(order_id, customer_name="Alice SIMULATE_FAIL")

        with self.assertRaises(RuntimeError) as ctx:
            run_fulfillment(
                order_id=order_id,
                provider_name="mock",
                email_provider="mock",
                db_path=str(self.db_path),
            )

        self.assertIn("Print partner order submission failed", str(ctx.exception))

        # Inspect database
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT status FROM "Order" WHERE id = ?', (order_id,))
        row = dict(cur.fetchone())
        self.assertEqual(row["status"], "fulfillment_failed")

        # Audit log must record failure
        cur.execute('SELECT * FROM "FulfillmentLog" WHERE orderId = ? AND status = "failed"', (order_id,))
        failed_log = cur.fetchone()
        self.assertIsNotNone(failed_log)
        conn.close()

    def test_unicode_and_special_characters_in_caption(self):
        """Captions with emojis, accents, and non-Latin glyphs must process without UnicodeEncodeError."""
        order_id = "ord_adv_unicode_03"
        unicode_caption = "🎵 Beethoven's Für Elise — Café & Crème 🎧 日本語テキスト 2026 ❤️"
        self._insert_order(order_id, caption=unicode_caption)

        summary = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )
        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")

    def test_extreme_long_caption_stress(self):
        """Extremely long caption (1500 characters) must not cause buffer overflow or crash."""
        order_id = "ord_adv_long_cap_04"
        long_caption = "A" * 1500
        self._insert_order(order_id, caption=long_caption)

        summary = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )
        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")

    def test_empty_caption_and_missing_address(self):
        """None/empty caption and empty address string must fallback safely."""
        order_id = "ord_adv_empty_fields_05"
        self._insert_order(order_id, caption="", shipping_address="")

        summary = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )
        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")

    def test_relational_schema_support(self):
        """Verifies fulfill.py also updates legacy relational schema (orders, order_items, order_customizations)."""
        rel_db_path = Path(self.tmp_dir.name) / "relational.db"
        conn = sqlite3.connect(str(rel_db_path))
        conn.executescript("""
        CREATE TABLE orders (
            id TEXT PRIMARY KEY,
            customer_email TEXT,
            customer_name TEXT,
            shipping_address_line1 TEXT,
            shipping_city TEXT,
            shipping_state TEXT,
            shipping_postal_code TEXT,
            status TEXT DEFAULT 'pending_fulfillment',
            print_partner_order_id TEXT,
            fulfillment_submitted_at TEXT,
            updated_at TEXT,
            total_cents INTEGER DEFAULT 9900,
            tracking_url TEXT
        );

        CREATE TABLE order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT,
            frame_size TEXT
        );

        CREATE TABLE order_customizations (
            id TEXT PRIMARY KEY,
            order_item_id TEXT,
            palette_id TEXT,
            text_caption TEXT,
            audio_storage_path TEXT,
            print_pdf_path TEXT,
            preview_image_path TEXT,
            print_pdf_file_size_bytes INTEGER
        );

        CREATE TABLE order_activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT,
            previous_status TEXT,
            new_status TEXT,
            note TEXT
        );
        """)

        order_id = "ord_rel_01"
        item_id = "item_rel_01"
        cust_id = "cust_rel_01"

        conn.execute(
            "INSERT INTO orders (id, customer_email, customer_name, shipping_address_line1, shipping_city, "
            "shipping_state, shipping_postal_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (order_id, "rel@example.com", "Relational User", "100 Relational Way", "Boston", "MA", "02108", "pending_fulfillment"),
        )
        conn.execute(
            "INSERT INTO order_items (id, order_id, frame_size) VALUES (?, ?, ?)",
            (item_id, order_id, "16x20"),
        )
        conn.execute(
            "INSERT INTO order_customizations (id, order_item_id, palette_id, text_caption, audio_storage_path) "
            "VALUES (?, ?, ?, ?, ?)",
            (cust_id, item_id, "midnight_gold", "Relational Sound", str(self.audio_wav)),
        )
        conn.commit()
        conn.close()

        summary = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(rel_db_path),
        )
        self.assertTrue(summary["success"])
        self.assertEqual(summary["status"], "fulfillment_submitted")

        # Verify relational tables updated
        conn = sqlite3.connect(str(rel_db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        ord_r = dict(cur.fetchone())
        self.assertEqual(ord_r["status"], "fulfillment_submitted")
        self.assertIsNotNone(ord_r["print_partner_order_id"])
        self.assertIsNotNone(ord_r["fulfillment_submitted_at"])

        cur.execute("SELECT * FROM order_customizations WHERE order_item_id = ?", (item_id,))
        cust_r = dict(cur.fetchone())
        self.assertIsNotNone(cust_r["print_pdf_path"])
        self.assertGreaterEqual(cust_r["print_pdf_file_size_bytes"], 1_000_000)
        conn.close()


class TestConcurrencyAndIdempotencyAdversarial(unittest.TestCase):
    """Category 3: Concurrency, multi-threading, idempotency, and double invocation."""

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp_dir.name) / "test_concurrency.db"
        self.audio_wav = Path(self.tmp_dir.name) / "audio.wav"
        generate_wav(str(self.audio_wav), duration_seconds=0.5)

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
        conn.commit()
        conn.close()

    def tearDown(self):
        self.tmp_dir.cleanup()

    def _insert_order(self, order_id: str) -> None:
        conn = sqlite3.connect(str(self.db_path))
        ts_ms = int(time.time() * 1000)
        conn.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, '
            'frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (
                order_id,
                "concurrent@example.com",
                "Concurrent Tester",
                "500 Race St, Philadelphia, PA 19106",
                "8x10",
                "midnight_gold",
                "Concurrency Test",
                str(self.audio_wav),
                "pending_fulfillment",
                4900,
                ts_ms,
                ts_ms,
            ),
        )
        conn.commit()
        conn.close()

    def test_sequential_double_fulfillment_idempotent_result(self):
        """Running fulfillment twice on the same order must succeed and leave DB in fulfillment_submitted."""
        order_id = "ord_seq_double_01"
        self._insert_order(order_id)

        res1 = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )
        self.assertTrue(res1["success"])
        partner_id_1 = res1["partnerOrderId"]

        # Run again
        res2 = run_fulfillment(
            order_id=order_id,
            provider_name="mock",
            email_provider="mock",
            db_path=str(self.db_path),
        )
        self.assertTrue(res2["success"])
        self.assertEqual(res2["status"], "fulfillment_submitted")

        # Verify DB is in valid state
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status, partnerOrderId FROM "Order" WHERE id = ?', (order_id,))
        row = cur.fetchone()
        conn.close()
        self.assertEqual(row[0], "fulfillment_submitted")
        self.assertIsNotNone(row[1])

    def test_concurrent_fulfillment_on_same_order(self):
        """Simultaneous fulfillment invocations on the same order via thread pool."""
        order_id = "ord_concurrent_same_02"
        self._insert_order(order_id)

        results = []
        errors = []

        def worker():
            try:
                res = run_fulfillment(
                    order_id=order_id,
                    provider_name="mock",
                    email_provider="mock",
                    db_path=str(self.db_path),
                )
                results.append(res)
            except Exception as e:
                errors.append(e)

        threads = [concurrent.futures.ThreadPoolExecutor(max_workers=2).submit(worker) for _ in range(2)]
        for t in threads:
            t.result()

        # At least one or both completed without unrecoverable crash
        self.assertGreater(len(results), 0, f"Both concurrent runs crashed with errors: {errors}")
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        cur.execute('SELECT status, partnerOrderId FROM "Order" WHERE id = ?', (order_id,))
        status, partner_id = cur.fetchone()
        conn.close()
        self.assertEqual(status, "fulfillment_submitted")
        self.assertIsNotNone(partner_id)

    def test_multi_order_concurrency_batch(self):
        """Process 4 distinct orders concurrently through ThreadPoolExecutor."""
        order_ids = [f"ord_multi_con_{i}" for i in range(4)]
        for oid in order_ids:
            self._insert_order(oid)

        def fulfill_task(oid: str) -> Dict[str, Any]:
            return run_fulfillment(
                order_id=oid,
                provider_name="mock",
                email_provider="mock",
                db_path=str(self.db_path),
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_oid = {executor.submit(fulfill_task, oid): oid for oid in order_ids}
            for future in concurrent.futures.as_completed(future_to_oid):
                oid = future_to_oid[future]
                res = future.result()
                self.assertTrue(res["success"])
                self.assertEqual(res["status"], "fulfillment_submitted")

        # Verify all 4 are in DB with status fulfillment_submitted
        conn = sqlite3.connect(str(self.db_path))
        cur = conn.cursor()
        for oid in order_ids:
            cur.execute('SELECT status, partnerOrderId FROM "Order" WHERE id = ?', (oid,))
            st, pid = cur.fetchone()
            self.assertEqual(st, "fulfillment_submitted")
            self.assertTrue(pid.startswith("ord_prodigi_mock_"))
        conn.close()


class TestEmailServiceSlaAdversarial(unittest.TestCase):
    """Category 4: Transactional Email Service SLA, metadata contracts, and rendering."""

    def setUp(self):
        email_service.MockEmailService.clear_sent_emails()

    def test_email_dispatch_timing_under_60s_sla(self):
        """Verification of < 60s transactional email SLA."""
        svc = email_service.get_email_service("mock")
        t0 = time.time()
        data = email_service.OrderConfirmationData(
            order_id="ord_sla_test_01",
            customer_email="sla_customer@example.com",
            customer_name="Flash Gordon",
            frame_size_label='24" × 36" Framed Print',
            palette_name="Midnight Gold",
            total_formatted="$149.00",
            caption="Speed of Sound",
        )
        res = svc.send_order_confirmation(data)
        elapsed = time.time() - t0

        self.assertTrue(res["success"])
        self.assertLess(elapsed, 1.0, f"Email queuing took {elapsed:.2f}s, exceeding immediate SLA target")
        self.assertLess(elapsed, 60.0, "Violates < 60s SLA requirement")

    def test_email_metadata_and_html_text_integrity(self):
        """Verifies customer name, order number, tracking link, and custom caption in both HTML and text bodies."""
        svc = email_service.get_email_service("mock")
        data = email_service.OrderConfirmationData(
            order_id="ord_meta_test_02",
            customer_email="meta@example.com",
            customer_name="Dr. Jane Doe",
            frame_size_label='16" × 20" Framed Print',
            palette_name="Dark Blue / White",
            total_formatted="$99.00",
            caption="Heartbeat of Maya — 03.15.2026",
            order_number=2048,
        )
        svc.send_order_confirmation(data)

        sent = email_service.MockEmailService.get_latest_email_for("meta@example.com")
        self.assertIsNotNone(sent)
        self.assertEqual(sent["orderId"], "ord_meta_test_02")
        self.assertEqual(sent["order_number"], 2048)
        self.assertEqual(sent["customer_name"], "Dr. Jane Doe")
        self.assertIn("/order/ord_meta_test_02", sent["status_url"])

        # Check HTML content
        html_body = sent["html"]
        self.assertIn("Dr. Jane Doe", html_body)
        self.assertIn("#2048", html_body)
        self.assertIn("Heartbeat of Maya — 03.15.2026", html_body)
        self.assertIn("/order/ord_meta_test_02", html_body)
        self.assertIn("$99.00", html_body)

        # Check plain text content
        text_body = sent["text"]
        self.assertIn("Dr. Jane Doe", text_body)
        self.assertIn("2048", text_body)
        self.assertIn("Heartbeat of Maya — 03.15.2026", text_body)
        self.assertIn("/order/ord_meta_test_02", text_body)

    def test_email_persists_to_disk_json_and_html(self):
        """Verifies MockEmailService writes artifact files to storage/test-emails."""
        tmp_emails_dir = tempfile.mkdtemp()
        try:
            svc = email_service.MockEmailService(storage_dir=tmp_emails_dir)
            data = email_service.OrderConfirmationData(
                order_id="ord_disk_persist_03",
                customer_email="disk@example.com",
                customer_name="Disk Inspector",
                frame_size_label='8" × 10" Framed Print',
                palette_name="White / Silver",
                total_formatted="$49.00",
            )
            svc.send_order_confirmation(data)

            json_path = Path(tmp_emails_dir) / "ord_disk_persist_03_email.json"
            html_path = Path(tmp_emails_dir) / "ord_disk_persist_03_email.html"

            self.assertTrue(json_path.exists(), "JSON email artifact was not created")
            self.assertTrue(html_path.exists(), "HTML email artifact was not created")

            with open(json_path, "r", encoding="utf-8") as f:
                saved_json = json.load(f)
            self.assertEqual(saved_json["orderId"], "ord_disk_persist_03")
        finally:
            shutil.rmtree(tmp_emails_dir, ignore_errors=True)


class TestPrintPartnerIntegrationAdversarial(unittest.TestCase):
    """Category 5: Print partner negative boundaries, SKU mapping verification, and error paths."""

    def setUp(self):
        print_partner.MockFulfillmentProvider.clear()

    def test_sku_mappings_for_all_four_frame_sizes(self):
        """Verifies Prodigi SKUs and Printify variant IDs for all 4 required frame sizes."""
        expected = {
            "8x10": "GLOBAL-CFP-8X10",
            "11x14": "GLOBAL-CFP-11X14",
            "16x20": "GLOBAL-CFP-16X20",
            "24x36": "GLOBAL-CFP-24X36",
        }
        for frame, expected_sku in expected.items():
            conf = print_partner.FRAME_SKU_MAPPINGS.get(frame)
            self.assertIsNotNone(conf, f"Missing frame config for {frame}")
            self.assertEqual(conf["prodigi_sku"], expected_sku)
            self.assertIn("printify_variant_id", conf)

    def test_mock_provider_rejects_empty_recipient_name(self):
        """Mock provider must reject empty recipient name."""
        provider = print_partner.get_fulfillment_provider("mock")
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_bad_name",
            recipient=print_partner.Recipient(
                name="",
                email="test@example.com",
                address=print_partner.RecipientAddress(line1="123 Main", city="Denver"),
            ),
            items=[print_partner.FulfillmentItem(sku="GLOBAL-CFP-16X20")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertIn("Recipient name is required", resp.errors[0])

    def test_mock_provider_rejects_incomplete_address(self):
        """Mock provider must reject missing line1 or city."""
        provider = print_partner.get_fulfillment_provider("mock")
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_bad_addr",
            recipient=print_partner.Recipient(
                name="Valid Name",
                email="test@example.com",
                address=print_partner.RecipientAddress(line1="", city=""),
            ),
            items=[print_partner.FulfillmentItem(sku="GLOBAL-CFP-16X20")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertIn("Incomplete shipping address", resp.errors[0])

    def test_mock_provider_rejects_invalid_sku(self):
        """Mock provider must reject unrecognized product SKU."""
        provider = print_partner.get_fulfillment_provider("mock")
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_bad_sku",
            recipient=print_partner.Recipient(
                name="Valid Name",
                email="test@example.com",
                address=print_partner.RecipientAddress(line1="123 Main", city="Denver"),
            ),
            items=[print_partner.FulfillmentItem(sku="INVALID-CUSTOM-SKU-999")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertIn("Invalid product SKU", resp.errors[0])

    def test_mock_provider_destination_country_xx_rejection(self):
        """Mock provider must simulate rejection on invalid destination country XX."""
        provider = print_partner.get_fulfillment_provider("mock")
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_bad_country",
            recipient=print_partner.Recipient(
                name="Valid Name",
                email="test@example.com",
                address=print_partner.RecipientAddress(line1="123 Main", city="Denver", country_code="XX"),
            ),
            items=[print_partner.FulfillmentItem(sku="GLOBAL-CFP-16X20")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertIn("invalid for destination country 'XX'", resp.errors[0])

    def test_mock_provider_query_nonexistent_order_status(self):
        """Querying status on a non-existent partner order ID returns stage=NotFound."""
        provider = print_partner.get_fulfillment_provider("mock")
        resp = provider.get_order_status("ord_prodigi_mock_does_not_exist_000")
        self.assertFalse(resp.success)
        self.assertEqual(resp.stage, "NotFound")

    def test_printify_provider_fails_safely_when_shop_id_missing(self):
        """Printify client must return clean failure response when shop_id is missing, without throwing."""
        provider = print_partner.PrintifyProvider(api_token="test_token", shop_id="")
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_printify_noshop",
            recipient=print_partner.Recipient(
                name="John Doe",
                email="john@example.com",
                address=print_partner.RecipientAddress(line1="123 St", city="City"),
            ),
            items=[print_partner.FulfillmentItem(sku="GLOBAL-CFP-16X20")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertIn("PRINTIFY_SHOP_ID is not configured", resp.errors[0])

    def test_printify_provider_network_failure_handled_gracefully(self):
        """Printify client network failure (bad host) must not raise unhandled exception."""
        provider = print_partner.PrintifyProvider(api_token="bad_token", shop_id="12345", timeout=2.0)
        provider.base_url = "http://127.0.0.1:54321/nonexistent"  # unreachable port
        req = print_partner.FulfillmentOrderRequest(
            internal_order_id="ord_printify_netfail",
            recipient=print_partner.Recipient(
                name="John Doe",
                email="john@example.com",
                address=print_partner.RecipientAddress(line1="123 St", city="City"),
            ),
            items=[print_partner.FulfillmentItem(sku="GLOBAL-CFP-16X20")],
        )
        resp = provider.create_order(req)
        self.assertFalse(resp.success)
        self.assertEqual(resp.outcome, "Failed")
        self.assertGreater(len(resp.errors), 0)


if __name__ == "__main__":
    unittest.main()
