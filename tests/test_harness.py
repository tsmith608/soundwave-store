"""
SoundWave Art E2E Test Suite - Shared Test Harness.
Provides opaque-box test utilities: audio synthesis, HTTP client,
database inspector, Stripe signature generator, and CLI invokers.
Zero external test framework dependencies required.
"""

import os
import sys
import json
import time
import math
import hmac
import wave
import struct
import hashlib
import sqlite3
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urljoin
import urllib.request
import urllib.error

# Project Roots
TESTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_DIR.parent
DEFAULT_BASE_URL = os.environ.get("SOUNDWAVE_BASE_URL", "http://localhost:3000")
DEFAULT_STRIPE_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_test_secret_32chars_long_1234567890")

# Authoritative Constants from PROJECT.md & survey_specs.md
FRAME_SIZES = {
    "8x10": {
        "label": "8\" × 10\"",
        "price_cents": 4900,
        "price_usd": 49.00,
        "aspect_ratio": "4:5",
        "aspect_ratio_float": 0.800,
        "w_in": 8,
        "h_in": 10,
        "w_px_300dpi": 2400,
        "h_px_300dpi": 3000,
        "prodigi_sku": "GLOBAL-CFP-8X10",
        "printify_variant_id": 70801,
    },
    "11x14": {
        "label": "11\" × 14\"",
        "price_cents": 6900,
        "price_usd": 69.00,
        "aspect_ratio": "11:14",
        "aspect_ratio_float": 0.786,
        "w_in": 11,
        "h_in": 14,
        "w_px_300dpi": 3300,
        "h_px_300dpi": 4200,
        "prodigi_sku": "GLOBAL-CFP-11X14",
        "printify_variant_id": 70802,
    },
    "16x20": {
        "label": "16\" × 20\"",
        "price_cents": 9900,
        "price_usd": 99.00,
        "aspect_ratio": "4:5",
        "aspect_ratio_float": 0.800,
        "w_in": 16,
        "h_in": 20,
        "w_px_300dpi": 4800,
        "h_px_300dpi": 6000,
        "prodigi_sku": "GLOBAL-CFP-16X20",
        "printify_variant_id": 70803,
    },
    "24x36": {
        "label": "24\" × 36\"",
        "price_cents": 14900,
        "price_usd": 149.00,
        "aspect_ratio": "2:3",
        "aspect_ratio_float": 0.667,
        "w_in": 24,
        "h_in": 36,
        "w_px_300dpi": 7200,
        "h_px_300dpi": 10800,
        "prodigi_sku": "GLOBAL-CFP-24X36",
        "printify_variant_id": 70804,
    },
}

PALETTES = {
    "midnight_gold": {
        "id": "midnight_gold",
        "name": "Midnight Gold",
        "bg": "#0c0c0c",
        "wave": "#d4af37",
    },
    "white_silver": {
        "id": "white_silver",
        "name": "White / Silver",
        "bg": "#ffffff",
        "wave": "#a0a0a0",
    },
    "dark_blue_white": {
        "id": "dark_blue_white",
        "name": "Dark Blue / White",
        "bg": "#0f172a",
        "wave": "#ffffff",
    },
}

ORDER_STATES = [
    "pending_payment",
    "pending_fulfillment",
    "fulfillment_submitted",
    "shipped",
    "delivered",
    "payment_failed",
    "cancelled",
    "fulfillment_failed",
]


# ============================================================================
# Synthetic Audio Generators (Isolated, Zero External Dependencies)
# ============================================================================

def generate_wav(
    filepath: str,
    duration_seconds: float = 2.0,
    sample_rate: int = 44100,
    frequency: float = 440.0,
    channels: int = 1,
    amplitude: float = 0.8,
) -> str:
    """Generates a valid PCM WAV audio file with pure sine wave signal."""
    num_samples = int(duration_seconds * sample_rate)
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            t = float(i) / sample_rate
            sample_val = int(32767.0 * amplitude * math.sin(2.0 * math.pi * frequency * t))
            sample_val = max(-32768, min(32767, sample_val))
            packed = struct.pack("<h", sample_val)
            for _ in range(channels):
                frames.extend(packed)

        wav_file.writeframes(frames)
    return filepath


def generate_silent_wav(
    filepath: str,
    duration_seconds: float = 2.0,
    sample_rate: int = 44100,
    channels: int = 1,
) -> str:
    """Generates a valid PCM WAV audio file containing absolute digital silence (0 amplitude)."""
    num_samples = int(duration_seconds * sample_rate)
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        # All zero bytes
        silent_frame = struct.pack("<h", 0) * channels
        wav_file.writeframes(silent_frame * num_samples)
    return filepath


def generate_corrupted_audio(filepath: str, mode: str = "random_bytes") -> str:
    """Generates various invalid/corrupted audio files for corner-case testing."""
    with open(filepath, "wb") as f:
        if mode == "truncated_header":
            # Valid RIFF header but cut off after 12 bytes
            f.write(b"RIFF\x24\x00\x00\x00WAVE")
        elif mode == "random_bytes":
            # 512 bytes of pseudorandom binary garbage
            f.write(os.urandom(512))
        elif mode == "zero_bytes":
            # 0-byte completely empty file
            pass
        elif mode == "text_masquerade":
            # Plain text file with .wav or .mp3 extension
            f.write(b"THIS IS NOT A VALID AUDIO FILE! Plain text file injection test.")
        elif mode == "bad_sample_rate":
            # RIFF WAV with nonsensical sample rate 0 or negative
            f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
        else:
            f.write(b"UNKNOWN_CORRUPT_MODE")
    return filepath


# ============================================================================
# Security & Signature Utilities
# ============================================================================

def compute_stripe_signature(
    payload_bytes: bytes,
    secret: str = DEFAULT_STRIPE_SECRET,
    timestamp: Optional[int] = None,
) -> str:
    """Computes a valid HMAC-SHA256 Stripe webhook signature header matching t={ts},v1={sig}."""
    if timestamp is None:
        timestamp = int(time.time())
    signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
    computed_hmac = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={computed_hmac}"


# ============================================================================
# HTTP Client Wrapper for Opaque-Box Testing
# ============================================================================

class HttpResponse:
    def __init__(self, status_code: int, body: bytes, headers: Dict[str, str]):
        self.status_code = status_code
        self.body = body
        self.headers = {k.lower(): v for k, v in headers.items()}

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.text)

    def is_success(self) -> bool:
        return 200 <= self.status_code < 300


_SERVER_REACHABLE_CACHE = None

class SoundWaveApiClient:
    """Client for testing SoundWave Art HTTP API endpoints without internal coupling."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def is_server_reachable(self, timeout: float = 0.2) -> bool:
        """Checks if the HTTP server is currently responding (cached for performance)."""
        global _SERVER_REACHABLE_CACHE
        if _SERVER_REACHABLE_CACHE is not None:
            return _SERVER_REACHABLE_CACHE
        import socket
        from urllib.parse import urlparse
        try:
            parsed = urlparse(self.base_url)
            host = parsed.hostname or "localhost"
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            with socket.create_connection((host, port), timeout=timeout):
                _SERVER_REACHABLE_CACHE = True
                return True
        except Exception:
            _SERVER_REACHABLE_CACHE = False
            return False

    def request(
        self,
        method: str,
        path: str,
        data: Optional[bytes] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 10.0,
    ) -> HttpResponse:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        req_headers = headers or {}
        req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                body = response.read()
                resp_headers = dict(response.info())
                return HttpResponse(response.status, body, resp_headers)
        except urllib.error.HTTPError as e:
            body = e.read()
            resp_headers = dict(e.headers)
            return HttpResponse(e.code, body, resp_headers)
        except Exception as e:
            # Return synthetic 503 if connection failed
            return HttpResponse(503, str(e).encode("utf-8"), {"content-type": "text/plain"})

    def get_landing_page(self) -> HttpResponse:
        return self.request("GET", "/")

    def upload_audio(
        self,
        file_path: str,
        content_type: str = "audio/wav",
        field_name: str = "audio",
    ) -> HttpResponse:
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        boundary = f"----WebKitFormBoundary{int(time.time() * 1000)}"
        body = bytearray()
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        }
        return self.request("POST", "/api/upload", data=bytes(body), headers=headers)

    def create_checkout(self, payload: Dict[str, Any]) -> HttpResponse:
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(data)),
        }
        return self.request("POST", "/api/checkout", data=data, headers=headers)

    def send_stripe_webhook(
        self,
        event_dict: Dict[str, Any],
        signature: Optional[str] = None,
        secret: str = DEFAULT_STRIPE_SECRET,
    ) -> HttpResponse:
        payload_bytes = json.dumps(event_dict).encode("utf-8")
        if signature is None:
            signature = compute_stripe_signature(payload_bytes, secret=secret)

        headers = {
            "Content-Type": "application/json",
            "stripe-signature": signature,
            "Content-Length": str(len(payload_bytes)),
        }
        return self.request("POST", "/api/webhooks/stripe", data=payload_bytes, headers=headers)

    def get_order(self, order_id: str) -> HttpResponse:
        return self.request("GET", f"/api/orders/{order_id}")

    def get_order_preview(self, order_id: str) -> HttpResponse:
        return self.request("GET", f"/api/orders/{order_id}/preview")

    def get_status_page(self, order_id: str) -> HttpResponse:
        return self.request("GET", f"/order/{order_id}")


# ============================================================================
# Database Inspector Helper
# ============================================================================

class DatabaseHelper:
    """Inspects SQLite database state directly according to schema contracts."""

    DEFAULT_PATHS = [
        PROJECT_ROOT / "prisma" / "dev.db",
        PROJECT_ROOT / "storage" / "soundwave.db",
        PROJECT_ROOT / "soundwave.db",
    ]

    @classmethod
    def find_db_path(cls, custom_path: Optional[str] = None) -> Optional[Path]:
        if custom_path and Path(custom_path).exists():
            return Path(custom_path)
        env_path = os.environ.get("DATABASE_PATH") or os.environ.get("DATABASE_URL")
        if env_path:
            clean = env_path.replace("file:", "").replace("sqlite:", "")
            p = Path(clean)
            if p.exists():
                return p
        for default_p in cls.DEFAULT_PATHS:
            if default_p.exists():
                return default_p
        return None

    @classmethod
    def get_connection(cls, db_path: Optional[str] = None) -> Optional[sqlite3.Connection]:
        path = cls.find_db_path(db_path)
        if not path:
            return None
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    def get_tables(cls, conn: sqlite3.Connection) -> list[str]:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        return [row[0] for row in cur.fetchall()]

    @classmethod
    def get_table_columns(cls, conn: sqlite3.Connection, table_name: str) -> list[str]:
        cur = conn.cursor()
        cur.execute(f'PRAGMA table_info("{table_name}")')
        return [row[1] for row in cur.fetchall()]


# ============================================================================
# CLI Fulfillment Runner Invoker
# ============================================================================

def invoke_fulfillment_cli(
    order_id: str,
    cwd: Optional[str] = None,
    timeout: float = 60.0,
) -> Tuple[int, str, str]:
    """Executes python -m backend.fulfill --order-id <order_id> as a black-box subprocess."""
    work_dir = cwd or str(PROJECT_ROOT)
    cmd = [sys.executable, "-m", "backend.fulfill", "--order-id", order_id]
    try:
        proc = subprocess.run(
            cmd,
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as e:
        return 124, "", f"Timeout after {timeout}s: {e}"
    except Exception as e:
        return 1, "", str(e)
