"""
Tier 1: Feature Coverage Tests.
Feature 16: CLI Fulfillment Runner (M2, R2).
Directly tests executable runner interface (python -m backend.fulfill --order-id <ID>),
exit codes, pipeline step sequencing, and database state updates in SQLite.
"""

import json
import os
from pathlib import Path
import time
import unittest
import uuid

from backend.fulfill import PIPELINE_STEPS
from tests.test_harness import DatabaseHelper, generate_wav, invoke_fulfillment_cli


class TestFeature16CliRunner(unittest.TestCase):
    """Verifies backend fulfillment CLI orchestration tool with genuine subprocess & DB execution."""

    def setUp(self):
        self.order_id = f"ord_feat16_{uuid.uuid4().hex[:10]}"
        self.wav_path = Path("storage/uploads") / f"{self.order_id}.wav"
        self.wav_path.parent.mkdir(parents=True, exist_ok=True)
        generate_wav(str(self.wav_path), duration_seconds=1.0)

        # Seed test order in database
        conn = DatabaseHelper.get_connection()
        self.assertIsNotNone(conn, "Database connection must be established")
        cur = conn.cursor()
        now_ts = int(time.time() * 1000)
        cur.execute(
            'INSERT INTO "Order" (id, customerEmail, shippingName, shippingAddress, frameSize, palette, caption, audioPath, status, totalAmount, createdAt, updatedAt) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                self.order_id,
                "runner_test@example.com",
                "Jane Runner",
                "123 Test St, Boston MA",
                "16x20",
                "midnight_gold",
                "Test Inscription",
                str(self.wav_path),
                "pending_fulfillment",
                9900,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        conn.close()

    def tearDown(self):
        conn = DatabaseHelper.get_connection()
        if conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM "Order" WHERE id = ?', (self.order_id,))
            cur.execute('DELETE FROM "FulfillmentLog" WHERE orderId = ?', (self.order_id,))
            conn.commit()
            conn.close()

        if self.wav_path.exists():
            try:
                self.wav_path.unlink()
            except Exception:
                pass

    def test_cli_runner_order_id_flag_invocation(self):
        """Verifies CLI accepts and evaluates --order-id argument against database."""
        nonexistent_id = f"ord_nonexistent_{uuid.uuid4().hex[:8]}"
        retcode, stdout, stderr = invoke_fulfillment_cli(order_id=nonexistent_id, timeout=15.0)
        self.assertNotEqual(retcode, 0, "CLI must exit with non-zero error when order does not exist")
        combined_output = stdout + stderr
        self.assertIn(
            nonexistent_id,
            combined_output,
            "CLI output must reference the requested order ID",
        )

    def test_cli_runner_fails_on_missing_order_id(self):
        """Verifies CLI fails cleanly with exit code 2 if --order-id flag is omitted or empty."""
        retcode, stdout, stderr = invoke_fulfillment_cli(order_id="", timeout=15.0)
        self.assertNotEqual(retcode, 0, "CLI must not succeed without an order ID")
        combined_output = stdout + stderr
        self.assertIn(
            "--order-id flag is required",
            combined_output,
            "CLI must log required argument error message",
        )

    def test_cli_runner_orchestrates_all_fulfillment_steps(self):
        """Verifies all 8 pipeline steps are defined in order and logged in FulfillmentLog."""
        expected_steps = [
            "fetch_order_from_db",
            "generate_waveform",
            "compile_300dpi_pdf",
            "verify_pdf_size_ge_1mb",
            "generate_preview_thumbnail",
            "submit_to_print_partner",
            "dispatch_confirmation_email",
            "update_order_status_to_submitted",
        ]
        self.assertEqual(PIPELINE_STEPS, expected_steps)
        self.assertEqual(len(PIPELINE_STEPS), 8)

        # Run fulfillment on the seeded order
        retcode, stdout, stderr = invoke_fulfillment_cli(order_id=self.order_id, timeout=40.0)
        self.assertEqual(retcode, 0, f"CLI runner failed: {stderr}")

        # Verify steps recorded in SQLite FulfillmentLog table
        conn = DatabaseHelper.get_connection()
        cur = conn.cursor()
        cur.execute(
            'SELECT step FROM "FulfillmentLog" WHERE orderId = ? ORDER BY timestamp ASC',
            (self.order_id,),
        )
        logged_steps = [row[0] for row in cur.fetchall()]
        conn.close()
        for step in expected_steps:
            self.assertIn(step, logged_steps, f"FulfillmentLog must contain record for step '{step}'")

    def test_cli_runner_updates_order_status_in_db(self):
        """Verifies runner updates Order status in DB to fulfillment_submitted with partnerOrderId."""
        retcode, stdout, stderr = invoke_fulfillment_cli(order_id=self.order_id, timeout=40.0)
        self.assertEqual(retcode, 0, f"CLI runner execution failed: {stderr}")

        try:
            summary = json.loads(stdout)
        except Exception:
            start_idx = stdout.find("{")
            end_idx = stdout.rfind("}") + 1
            summary = json.loads(stdout[start_idx:end_idx])

        self.assertTrue(summary.get("success"), "Runner summary must report success")
        self.assertEqual(summary.get("status"), "fulfillment_submitted")

        # Direct database query to verify persisted state
        conn = DatabaseHelper.get_connection()
        cur = conn.cursor()
        cur.execute(
            'SELECT status, partnerOrderId, printPdfPath, previewUrl FROM "Order" WHERE id = ?',
            (self.order_id,),
        )
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row, "Order must exist in database")
        self.assertEqual(row[0], "fulfillment_submitted", "Order status in DB must be fulfillment_submitted")
        self.assertIsNotNone(row[1], "partnerOrderId must be populated")
        self.assertTrue(row[1].startswith("ord_prodigi_mock_"), f"Unexpected partner ID: {row[1]}")
        self.assertIsNotNone(row[2], "printPdfPath must be set")

    def test_cli_runner_exit_code_contract(self):
        """Verifies exit code contract: 0 for successful run, non-zero for any failure."""
        # Non-zero on failure
        ret_fail, _, _ = invoke_fulfillment_cli(order_id="ord_invalid_exit_code_test", timeout=15.0)
        self.assertNotEqual(ret_fail, 0, "Failed runner execution must yield non-zero exit code")

        # Zero on success
        ret_succ, stdout, stderr = invoke_fulfillment_cli(order_id=self.order_id, timeout=40.0)
        self.assertEqual(ret_succ, 0, f"Successful runner execution must yield 0 exit code: {stderr}")


if __name__ == "__main__":
    unittest.main()
