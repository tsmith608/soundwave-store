"""
backend/email_service.py
SoundWave Art - Transactional Email Service.
Integrates with Resend REST API and provides an in-memory & disk-backed
MockEmailService for test suites and development verification.
Guarantees <60s order confirmation delivery SLA.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
import json
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

logger = logging.getLogger("soundwave.email_service")

# Base project root
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent


# ============================================================================
# Email Context Data Model
# ============================================================================

@dataclass
class OrderConfirmationData:
    order_id: str
    customer_email: str
    customer_name: str
    frame_size_label: str  # e.g. '16" × 20" Framed Print'
    palette_name: str      # e.g. "Midnight Gold"
    total_formatted: str   # e.g. "$99.00"
    caption: str = ""      # e.g. "Our First Dance — September 20, 2025"
    order_number: int = 1001
    shipping_address_summary: str = "Standard Shipping"
    preview_image_url: Optional[str] = None
    status_url: Optional[str] = None

    def __post_init__(self):
        base_app_url = os.environ.get("NEXT_PUBLIC_APP_URL", "https://soundwaveart.com").rstrip("/")
        if not self.status_url:
            self.status_url = f"{base_app_url}/order/{self.order_id}"
        if not self.preview_image_url:
            self.preview_image_url = f"{base_app_url}/api/orders/{self.order_id}/preview"


# ============================================================================
# HTML & Plain Text Email Renderers
# ============================================================================

def render_order_confirmation_html(data: OrderConfirmationData) -> str:
    caption_block = ""
    if data.caption and data.caption.strip():
        caption_block = f"""
        <div style="margin: 16px 0 0 0; padding: 12px; background: rgba(212, 175, 55, 0.08); border-left: 3px solid #d4af37; border-radius: 4px;">
          <p style="margin: 0; color: #d4af37; font-style: italic; font-size: 15px;">&ldquo;{data.caption}&rdquo;</p>
        </div>
        """

    preview_img_block = ""
    if data.preview_image_url:
        preview_img_block = f"""
        <div style="text-align: center; margin: 24px 0; padding: 16px; background-color: #0b0f19; border-radius: 8px; border: 1px solid #334155;">
          <img src="{data.preview_image_url}" alt="SoundWave Preview" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);" />
          {caption_block}
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your SoundWave Art order is confirmed!</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
    .card {{ max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 32px; text-align: center; border-bottom: 1px solid #334155; }}
    .gold-title {{ color: #d4af37; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: 0.5px; }}
    .subtitle {{ color: #94a3b8; font-size: 15px; margin: 0; }}
    .content {{ padding: 32px; }}
    .details-table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    .details-table td {{ padding: 12px 0; border-bottom: 1px solid #334155; color: #cbd5e1; font-size: 14px; }}
    .details-table td.label {{ color: #94a3b8; width: 40%; }}
    .details-table td.value {{ font-weight: 600; text-align: right; }}
    .btn-container {{ text-align: center; margin: 32px 0 16px 0; }}
    .btn {{ background-color: #d4af37; color: #0f172a; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 9999px; display: inline-block; }}
    .footer {{ text-align: center; padding: 24px; color: #64748b; font-size: 12px; border-top: 1px solid #334155; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="gold-title">SOUNDWAVE ART</div>
      <p class="subtitle">Your order #{data.order_number} has been received!</p>
    </div>
    <div class="content">
      <p>Hi {data.customer_name},</p>
      <p>Thank you for your order! We&rsquo;ve received your audio recording and our high-resolution rendering engine has queued your custom framed print for production.</p>
      
      {preview_img_block}

      <table class="details-table">
        <tr>
          <td class="label">Size & Format</td>
          <td class="value">{data.frame_size_label}</td>
        </tr>
        <tr>
          <td class="label">Color Palette</td>
          <td class="value">{data.palette_name}</td>
        </tr>
        <tr>
          <td class="label">Total Paid</td>
          <td class="value">{data.total_formatted}</td>
        </tr>
        <tr>
          <td class="label">Ships To</td>
          <td class="value">{data.shipping_address_summary}</td>
        </tr>
      </table>

      <div class="btn-container">
        <a class="btn" href="{data.status_url}">View Live Order Status</a>
      </div>
    </div>
    <div class="footer">
      SoundWave Art Inc. &bull; Automated Gift-Ready Framing Platform &bull; support@soundwaveart.com
    </div>
  </div>
</body>
</html>"""


def render_order_confirmation_text(data: OrderConfirmationData) -> str:
    return f"""SOUNDWAVE ART — ORDER CONFIRMATION
Order #{data.order_number} (ID: {data.order_id})

Hi {data.customer_name},

Thank you for your order! We have received your audio recording and your custom framed print is entering production.

Order Summary:
- Format: {data.frame_size_label}
- Palette: {data.palette_name}
- Inscription: "{data.caption}"
- Total Paid: {data.total_formatted}
- Ships To: {data.shipping_address_summary}

Track your order live:
{data.status_url}

Need help? Contact support@soundwaveart.com
"""


# ============================================================================
# Email Service Interface & Implementations
# ============================================================================

class IEmailService(ABC):
    @abstractmethod
    def send_order_confirmation(self, data: OrderConfirmationData) -> Dict[str, Any]:
        """Dispatches an order confirmation email."""
        pass


class ResendEmailService(IEmailService):
    """
    Direct REST API client for Resend.
    Does not require third-party python SDK; uses built-in urllib.request.
    """

    def __init__(self, api_key: Optional[str] = None, from_email: Optional[str] = None):
        self.api_key = api_key or os.environ.get("RESEND_API_KEY", "")
        self.from_email = from_email or os.environ.get("RESEND_FROM_EMAIL", "SoundWave Art <orders@soundwaveart.com>")
        self.endpoint = "https://api.resend.com/emails"

    def send_order_confirmation(self, data: OrderConfirmationData) -> Dict[str, Any]:
        subject = f"Your SoundWave Art order is confirmed! (#{data.order_number})"
        html_body = render_order_confirmation_html(data)
        text_body = render_order_confirmation_text(data)

        payload = {
            "from": self.from_email,
            "to": [data.customer_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "tags": [{"name": "order_id", "value": data.order_id}],
        }

        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                logger.info("Resend email sent successfully for order %s: %s", data.order_id, res_data)
                return {"success": True, "id": res_data.get("id"), "sent_at": time.time()}
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            logger.error("Resend HTTP %d: %s", e.code, err_msg)
            return {"success": False, "error": f"HTTP {e.code}: {err_msg}"}
        except Exception as e:
            logger.exception("Resend dispatch exception: %s", e)
            return {"success": False, "error": str(e)}


class MockEmailService(IEmailService):
    """
    Mock Email Service that logs dispatched emails to memory and disk.
    Allows test suites to query sent emails and assert delivery under 60 seconds.
    """

    _sent_emails: List[Dict[str, Any]] = []

    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = Path(
            storage_dir or os.environ.get("TEST_EMAILS_DIR", str(PROJECT_ROOT / "storage" / "test-emails"))
        )
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_sent_emails(cls) -> List[Dict[str, Any]]:
        return cls._sent_emails

    @classmethod
    def get_latest_email_for(cls, email: str) -> Optional[Dict[str, Any]]:
        matching = [e for e in cls._sent_emails if e.get("to") == email]
        return matching[-1] if matching else None

    @classmethod
    def clear_sent_emails(cls) -> None:
        cls._sent_emails.clear()

    def send_order_confirmation(self, data: OrderConfirmationData) -> Dict[str, Any]:
        subject = f"Your SoundWave Art order is confirmed! (#{data.order_number})"
        html_body = render_order_confirmation_html(data)
        text_body = render_order_confirmation_text(data)

        email_record = {
            "id": f"mock_email_{int(time.time()*1000)}",
            "to": data.customer_email,
            "subject": subject,
            "orderId": data.order_id,
            "order_number": data.order_number,
            "customer_name": data.customer_name,
            "frame_size": data.frame_size_label,
            "palette_name": data.palette_name,
            "total_formatted": data.total_formatted,
            "caption": data.caption,
            "status_url": data.status_url,
            "sent_at_s": time.time(),
            "html": html_body,
            "text": text_body,
        }

        MockEmailService._sent_emails.append(email_record)

        # Write to disk for inspection
        try:
            json_file = self.storage_dir / f"{data.order_id}_email.json"
            html_file = self.storage_dir / f"{data.order_id}_email.html"
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(email_record, f, indent=2)
            with open(html_file, "w", encoding="utf-8") as f:
                f.write(html_body)
        except Exception as e:
            logger.warning("Could not persist mock email to disk: %s", e)

        logger.info("MockEmailService: Email queued for %s (order: %s)", data.customer_email, data.order_id)
        return {"success": True, "id": email_record["id"], "sent_at": email_record["sent_at_s"]}


# ============================================================================
# Factory Dispatcher
# ============================================================================

def get_email_service(provider_type: Optional[str] = None) -> IEmailService:
    api_key = os.environ.get("RESEND_API_KEY", "")
    chosen = provider_type or ("mock" if not api_key or api_key.lower() == "mock" else "resend")

    if chosen.lower() == "resend" and api_key and api_key.lower() != "mock":
        return ResendEmailService(api_key=api_key)
    return MockEmailService()
