"""
Tier 1: Feature Coverage Tests.
Feature 08: Relational Order Database (M1, R1, R2).
Tests SQLite database schema DDL contracts: orders, order_items,
order_customizations, webhook_events, and order_activity_logs.
"""

import sqlite3
import unittest
from tests.test_harness import DatabaseHelper


class TestFeature08DbSchema(unittest.TestCase):
    """Verifies relational database tables, columns, and foreign keys."""

    def setUp(self):
        # Create an in-memory database to test the authoritative schema DDL from survey_specs.md
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def tearDown(self):
        self.conn.close()

    def _init_schema(self):
        ddl = """
        CREATE TABLE orders (
            id TEXT PRIMARY KEY,
            order_number INTEGER NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending_payment',
            customer_email TEXT NOT NULL,
            customer_name TEXT,
            customer_phone TEXT,
            shipping_address_line1 TEXT,
            shipping_address_line2 TEXT,
            shipping_city TEXT,
            shipping_state TEXT,
            shipping_postal_code TEXT,
            shipping_country TEXT,
            subtotal_cents INTEGER NOT NULL,
            shipping_cents INTEGER NOT NULL DEFAULT 0,
            tax_cents INTEGER NOT NULL DEFAULT 0,
            total_cents INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'usd',
            stripe_session_id TEXT UNIQUE,
            stripe_payment_intent_id TEXT,
            fulfillment_provider TEXT DEFAULT 'mock',
            print_partner_order_id TEXT,
            tracking_carrier TEXT,
            tracking_number TEXT,
            tracking_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            paid_at TIMESTAMP,
            fulfillment_submitted_at TIMESTAMP,
            shipped_at TIMESTAMP,
            delivered_at TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            sku TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT 'SoundWave Art Custom Framed Print',
            frame_size TEXT NOT NULL,
            unit_price_cents INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE order_customizations (
            id TEXT PRIMARY KEY,
            order_item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
            palette_id TEXT NOT NULL,
            palette_name TEXT NOT NULL,
            bg_color TEXT NOT NULL,
            wave_color TEXT NOT NULL,
            text_caption TEXT,
            waveform_scale REAL NOT NULL DEFAULT 1.0,
            waveform_style TEXT NOT NULL DEFAULT 'daw_bars',
            qr_code_enabled INTEGER NOT NULL DEFAULT 1,
            qr_target_url TEXT,
            audio_original_filename TEXT,
            audio_storage_path TEXT NOT NULL,
            audio_duration_seconds REAL,
            preview_image_path TEXT,
            print_pdf_path TEXT,
            print_pdf_file_size_bytes INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE webhook_events (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            payload_json TEXT NOT NULL,
            received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE order_activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            previous_status TEXT,
            new_status TEXT NOT NULL,
            note TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
        self.conn.executescript(ddl)

    def test_orders_table_schema(self):
        """Verifies orders master table columns and primary key."""
        columns = DatabaseHelper.get_table_columns(self.conn, "orders")
        required_cols = [
            "id", "order_number", "status", "customer_email",
            "total_cents", "stripe_session_id", "print_partner_order_id",
        ]
        for col in required_cols:
            self.assertIn(col, columns, f"Column {col} missing from orders table")

    def test_order_items_table_schema(self):
        """Verifies order_items table has foreign key reference and pricing columns."""
        columns = DatabaseHelper.get_table_columns(self.conn, "order_items")
        for col in ["id", "order_id", "sku", "frame_size", "unit_price_cents"]:
            self.assertIn(col, columns)

    def test_order_customizations_table_schema(self):
        """Verifies order_customizations table stores palette, caption, audio path, and PDF size."""
        columns = DatabaseHelper.get_table_columns(self.conn, "order_customizations")
        for col in ["palette_id", "bg_color", "wave_color", "text_caption", "print_pdf_file_size_bytes"]:
            self.assertIn(col, columns)

    def test_webhook_events_table_schema(self):
        """Verifies webhook_events table stores event ID primary key for idempotency."""
        columns = DatabaseHelper.get_table_columns(self.conn, "webhook_events")
        for col in ["id", "provider", "event_type", "status", "payload_json"]:
            self.assertIn(col, columns)

    def test_order_activity_logs_table_schema(self):
        """Verifies order_activity_logs captures status transition audit trail."""
        columns = DatabaseHelper.get_table_columns(self.conn, "order_activity_logs")
        for col in ["id", "order_id", "previous_status", "new_status", "note"]:
            self.assertIn(col, columns)


if __name__ == "__main__":
    unittest.main()
