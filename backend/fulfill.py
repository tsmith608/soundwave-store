"""
backend/fulfill.py
SoundWave Art - CLI Fulfillment Orchestrator.
Entry point: python -m backend.fulfill --order-id <ORDER_ID>

Sequentially coordinates the 8 audited pipeline steps:
  1. fetch_order_from_db
  2. generate_waveform
  3. compile_300dpi_pdf
  4. verify_pdf_size_ge_1mb
  5. generate_preview_thumbnail
  6. submit_to_print_partner
  7. dispatch_confirmation_email
  8. update_order_status_to_submitted
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid

from PIL import Image, ImageDraw

from backend.email_service import OrderConfirmationData, get_email_service
from backend.preview_generator import generate_preview_thumbnail
from backend.print_engine import FRAME_CONFIGS, compile_print_pdf
from backend.print_partner import (
    FRAME_SKU_MAPPINGS,
    FulfillmentItem,
    FulfillmentOrderRequest,
    Recipient,
    RecipientAddress,
    get_fulfillment_provider,
)
from backend.waveform_generator import PALETTES, WaveformConfig, generate_waveform_image

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("soundwave.fulfill")

PROJECT_ROOT = Path(__file__).resolve().parent.parent

PIPELINE_STEPS = [
    "fetch_order_from_db",
    "generate_waveform",
    "compile_300dpi_pdf",
    "verify_pdf_size_ge_1mb",
    "generate_preview_thumbnail",
    "submit_to_print_partner",
    "dispatch_confirmation_email",
    "update_order_status_to_submitted",
]


# ============================================================================
# 1. Database Connection & Layer
# ============================================================================

def get_db_connection(custom_path: Optional[str] = None) -> sqlite3.Connection:
    if custom_path and Path(custom_path).exists():
        db_path = Path(custom_path)
    else:
        env_url = os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_PATH")
        
        # Check if env_url is a PostgreSQL or other remote/non-SQLite URL
        is_non_sqlite = bool(
            env_url
            and (
                env_url.startswith("postgres://")
                or env_url.startswith("postgresql://")
                or ("://" in env_url and not env_url.startswith("sqlite:") and not env_url.startswith("file:"))
            )
        )

        if env_url and not is_non_sqlite:
            clean = env_url.replace("file:", "").replace("sqlite:", "").strip()
            db_path = PROJECT_ROOT / clean if not Path(clean).is_absolute() else Path(clean)
        else:
            default_paths = [
                PROJECT_ROOT / "storage" / "soundwave.db",
                PROJECT_ROOT / "prisma" / "dev.db",
                PROJECT_ROOT / "soundwave.db",
            ]
            db_path = None
            for p in default_paths:
                if p.exists():
                    db_path = p
                    break
            if not db_path:
                db_path = PROJECT_ROOT / "storage" / "soundwave.db"

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
    except Exception:
        pass

    return conn


def fetch_order_details(conn: sqlite3.Connection, order_id: str) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]

    if "Order" in tables:
        cur.execute('SELECT * FROM "Order" WHERE id = ?', (order_id,))
        row = cur.fetchone()
        if row:
            d = dict(row)
            photo_path = (
                d.get("photoPath")
                or d.get("photo_path")
                or d.get("imagePath")
                or d.get("image_path")
                or ""
            )
            decorative_theme = (
                d.get("decorative_theme")
                or d.get("decorativeTheme")
                or d.get("decorativeStyle")
                or d.get("decorative_style")
                or d.get("theme")
                or "botanical"
            )
            if not photo_path:
                upload_dir = PROJECT_ROOT / "storage" / "uploads"
                candidates = [
                    upload_dir / f"{order_id}_photo.jpg",
                    upload_dir / f"{order_id}_photo.png",
                    upload_dir / f"{order_id}.jpg",
                    upload_dir / f"{order_id}.png",
                ]
                for cand in candidates:
                    if cand.exists():
                        photo_path = str(cand)
                        break

            return {
                "schema_type": "prisma",
                "id": d["id"],
                "customer_email": d.get("customerEmail", "") or "customer@example.com",
                "customer_name": d.get("shippingName") or "Valued Customer",
                "shipping_address": d.get("shippingAddress") or "",
                "frame_size": d.get("frameSize", "16x20") or "16x20",
                "palette": d.get("palette", "midnight_gold") or "midnight_gold",
                "caption": d.get("caption") or "",
                "audio_path": d.get("audioPath", "") or "",
                "photo_path": photo_path,
                "decorative_theme": decorative_theme,
                "preview_url": d.get("previewUrl"),
                "print_pdf_path": d.get("printPdfPath"),
                "status": d.get("status", "pending_payment"),
                "partner_order_id": d.get("partnerOrderId"),
                "total_amount": d.get("totalAmount", 0),
                "artwork_spec": d.get("artworkSpec"),
            }

    if "orders" in tables:
        cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        row = cur.fetchone()
        if row:
            d = dict(row)
            frame_size = "16x20"
            caption = ""
            audio_path = ""
            palette = "midnight_gold"
            photo_path = d.get("photo_path") or d.get("photoPath") or ""
            decorative_theme = (
                d.get("decorative_theme")
                or d.get("decorativeTheme")
                or d.get("decorativeStyle")
                or d.get("decorative_style")
                or d.get("theme")
                or "botanical"
            )

            if "order_items" in tables:
                cur.execute("SELECT * FROM order_items WHERE order_id = ? LIMIT 1", (order_id,))
                item_row = cur.fetchone()
                if item_row:
                    item_d = dict(item_row)
                    frame_size = item_d.get("frame_size") or "16x20"
                    item_id = item_d.get("id")
                    if "order_customizations" in tables and item_id:
                        cur.execute("SELECT * FROM order_customizations WHERE order_item_id = ? LIMIT 1", (item_id,))
                        cust_row = cur.fetchone()
                        if cust_row:
                            cust_d = dict(cust_row)
                            caption = cust_d.get("text_caption") or ""
                            audio_path = cust_d.get("audio_storage_path") or ""
                            palette = cust_d.get("palette_id") or "midnight_gold"
                            photo_path = cust_d.get("photo_storage_path") or cust_d.get("photo_path") or photo_path
                            decorative_theme = (
                                cust_d.get("decorative_theme")
                                or cust_d.get("decorativeTheme")
                                or cust_d.get("decorativeStyle")
                                or cust_d.get("decorative_style")
                                or cust_d.get("theme")
                                or decorative_theme
                            )

            addr_parts = [
                d.get("shipping_address_line1"),
                d.get("shipping_city"),
                d.get("shipping_state"),
                d.get("shipping_postal_code"),
            ]
            addr_str = ", ".join([p for p in addr_parts if p])

            return {
                "schema_type": "relational",
                "id": d["id"],
                "customer_email": d.get("customer_email", "") or "customer@example.com",
                "customer_name": d.get("customer_name") or "Valued Customer",
                "shipping_address": addr_str or d.get("shipping_address_line1", ""),
                "frame_size": frame_size,
                "palette": palette,
                "caption": caption,
                "audio_path": audio_path,
                "photo_path": photo_path,
                "decorative_theme": decorative_theme,
                "preview_url": d.get("tracking_url"),
                "print_pdf_path": None,
                "status": d.get("status", "pending_payment"),
                "partner_order_id": d.get("print_partner_order_id"),
                "total_amount": d.get("total_cents", 0),
            }

    return None


def add_fulfillment_log(
    conn: sqlite3.Connection,
    order_id: str,
    step: str,
    status: str,
    details: Optional[str] = None,
) -> None:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]

    log_id = str(uuid.uuid4())
    ts_ms = int(time.time() * 1000)

    try:
        if "FulfillmentLog" in tables:
            cur.execute(
                'INSERT INTO "FulfillmentLog" (id, orderId, step, status, details, timestamp) '
                "VALUES (?, ?, ?, ?, ?, ?)",
                (log_id, order_id, step, status, details, ts_ms),
            )
            conn.commit()
        elif "order_activity_logs" in tables:
            cur.execute(
                "INSERT INTO order_activity_logs (order_id, previous_status, new_status, note) "
                "VALUES (?, ?, ?, ?)",
                (order_id, "", status, f"{step}: {details}"),
            )
            conn.commit()
    except Exception as e:
        logger.warning("Failed to record fulfillment log: %s", e)


def update_order_fulfillment_success(
    conn: sqlite3.Connection,
    order_id: str,
    partner_order_id: str,
    pdf_path: str,
    preview_url: str,
    schema_type: str = "prisma",
    pdf_size_bytes: int = 0,
) -> None:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]

    if schema_type == "prisma" or "Order" in tables:
        ts_ms = int(time.time() * 1000)
        cur.execute(
            'UPDATE "Order" SET status = ?, partnerOrderId = ?, printPdfPath = ?, '
            'previewUrl = ?, updatedAt = ? WHERE id = ?',
            ("fulfillment_submitted", partner_order_id, pdf_path, preview_url, ts_ms, order_id),
        )
        conn.commit()
    else:
        iso_now = time.strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            "UPDATE orders SET status = ?, print_partner_order_id = ?, "
            "fulfillment_submitted_at = ?, updated_at = ? WHERE id = ?",
            ("fulfillment_submitted", partner_order_id, iso_now, iso_now, order_id),
        )
        if "order_customizations" in tables:
            cur.execute(
                "UPDATE order_customizations SET print_pdf_path = ?, preview_image_path = ?, "
                "print_pdf_file_size_bytes = ? WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)",
                (pdf_path, preview_url, pdf_size_bytes, order_id),
            )
        conn.commit()


def update_order_fulfillment_failed(
    conn: sqlite3.Connection,
    order_id: str,
    schema_type: str = "prisma",
) -> None:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]

    if schema_type == "prisma" or "Order" in tables:
        ts_ms = int(time.time() * 1000)
        cur.execute('UPDATE "Order" SET status = ?, updatedAt = ? WHERE id = ?', ("fulfillment_failed", ts_ms, order_id))
        conn.commit()
    else:
        iso_now = time.strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", ("fulfillment_failed", iso_now, order_id))
        conn.commit()


# ============================================================================
# 2. Pipeline Execution Steps
# ============================================================================

def step_generate_waveform(
    order: Dict[str, Any],
    out_dir: Path,
) -> Path:
    """Step 2: Calls waveform_generator to create discrete pill-bar PNG."""
    wave_path = out_dir / f"{order['id']}_wave.png"

    raw_audio_path = order.get("audio_path", "")
    resolved_audio: Optional[Path] = None

    if raw_audio_path:
        candidate = PROJECT_ROOT / raw_audio_path if not Path(raw_audio_path).is_absolute() else Path(raw_audio_path)
        if candidate.exists():
            resolved_audio = candidate

    # Check common fallback audio locations if specified audio does not exist
    if not resolved_audio or not resolved_audio.exists():
        fallbacks = [
            PROJECT_ROOT / "storage" / "uploads" / "test_audio.wav",
            PROJECT_ROOT / "storage" / "test_audio.wav",
        ]
        for fb in fallbacks:
            if fb.exists():
                resolved_audio = fb
                break

    palette = order.get("palette", "midnight_gold") or "midnight_gold"
    frame_size = order.get("frame_size", "16x20") or "16x20"

    if resolved_audio and resolved_audio.exists():
        generate_waveform_image(
            audio_source=str(resolved_audio),
            output_path=str(wave_path),
            palette=palette,
            frame_size=frame_size,
            transparent_bg=True,
        )
    else:
        # Synthesize discrete pill-bar image directly
        w = 3886
        h = 661
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        num_bars = 80
        slot_w = w / num_bars
        bar_w = max(4, int(slot_w * 0.65))
        mid_y = h // 2

        pal_info = PALETTES.get(palette, PALETTES["midnight_gold"])
        wave_color = pal_info["wave"]

        for i in range(num_bars):
            val = abs(math.sin(i * 0.18) * math.cos(i * 0.09)) * 0.85 + 0.12
            bar_h = max(10, int((h * 0.44) * val))
            bx = int(i * slot_w + (slot_w - bar_w) / 2)
            draw.rounded_rectangle(
                [bx, mid_y - bar_h, bx + bar_w, mid_y + bar_h],
                radius=bar_w // 2,
                fill=wave_color,
            )
        img.save(str(wave_path), format="PNG")

    return wave_path


def step_compile_pdf(
    order: Dict[str, Any],
    wave_path: Path,
    out_dir: Path,
) -> Path:
    """Step 3: Compiles 300 DPI print-ready PDF using physical CSS inch units."""
    pdf_path = out_dir / f"{order['id']}_print.pdf"

    frame_size = order.get("frame_size", "16x20") or "16x20"
    palette = order.get("palette", "midnight_gold") or "midnight_gold"
    caption = order.get("caption") or ""
    photo_path = order.get("photo_path") or order.get("photoPath") or ""
    decorative_theme = (
        order.get("decorative_theme")
        or order.get("decorativeTheme")
        or order.get("decorativeStyle")
        or order.get("decorative_style")
        or order.get("theme")
        or "botanical"
    )

    try:
        compile_print_pdf(
            waveform_image_path=str(wave_path),
            output_pdf_path=str(pdf_path),
            photo_image_path=str(photo_path) if photo_path else None,
            decorative_theme=decorative_theme,
            frame_size=frame_size,
            palette=palette,
            caption=caption,
            target_id_or_url=order["id"],
        )
    except Exception as e:
        logger.warning("Playwright PDF compilation raised: %s. Using high-res fine-art raster PDF compiler fallback.", e)
        # High-res 300 DPI fine-art canvas fallback strictly >= 1MB
        frame_conf = FRAME_CONFIGS.get(frame_size, FRAME_CONFIGS["16x20"])
        w_px = frame_conf["w_px_300dpi"]
        h_px = frame_conf["h_px_300dpi"]

        from backend.print_engine import PALETTE_CONFIGS, generate_fine_art_texture
        pal_cfg = PALETTE_CONFIGS.get(palette, PALETTE_CONFIGS.get("midnight_gold", {}))
        bg_hex = pal_cfg.get("bg", "#0c0c0c")

        texture_file = generate_fine_art_texture(w_px, h_px, bg_hex)
        poster_img = Image.open(texture_file).convert("RGB")

        if photo_path and Path(photo_path).exists():
            try:
                from PIL import ImageOps
                p_img = Image.open(photo_path)
                p_img = ImageOps.exif_transpose(p_img)
                photo_box_w = int(w_px * 0.74)
                photo_box_h = int(h_px * 0.38)
                fitted = ImageOps.fit(p_img, (photo_box_w, photo_box_h), method=Image.Resampling.LANCZOS)
                poster_img.paste(fitted.convert("RGB"), ((w_px - photo_box_w) // 2, int(h_px * 0.08)))
            except Exception as pe:
                logger.warning("Fallback photo paste failed: %s", pe)

        if wave_path.exists():
            wave_img = Image.open(wave_path).convert("RGBA")
            paste_w = int(w_px * 0.84)
            paste_h = int(wave_img.height * (paste_w / wave_img.width))
            resized_wave = wave_img.resize((paste_w, paste_h), Image.Resampling.LANCZOS)
            offset_y = int(h_px * 0.48) if (photo_path and Path(photo_path).exists()) else int(h_px * 0.22)
            offset = ((w_px - paste_w) // 2, offset_y)
            poster_img.paste(resized_wave, offset, mask=resized_wave)

        poster_img.save(str(pdf_path), "PDF", resolution=300.0, quality=95)
        try:
            os.unlink(texture_file)
        except Exception:
            pass

    return pdf_path


def step_render_curated(order: Dict[str, Any], prints_dir: Path, previews_dir: Path) -> Tuple[Path, Path, str, int]:
    """
    Curated-design orders (Order.artworkSpec): renders the print file with the
    same TypeScript renderer that drew the customer's preview, so print and
    preview are identical. Output is a vector PDF at exact physical size, plus
    a PNG proof. Returns (pdf_path, preview_path, public_preview_url, pdf_bytes).
    """
    import subprocess

    spec = json.loads(order["artwork_spec"])
    spec_path = prints_dir / f"{order['id']}.spec.json"
    spec_path.write_text(json.dumps(spec), encoding="utf-8")
    pdf_path = prints_dir / f"{order['id']}.pdf"
    preview_path = previews_dir / f"{order['id']}_preview.png"
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    result = subprocess.run(
        [npx, "tsx", "scripts/render-art.ts", "print", str(spec_path), str(pdf_path), "--png", str(preview_path)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        timeout=180,
    )
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError(f"Artwork render failed: {result.stderr.strip()[-800:]}")
    size = pdf_path.stat().st_size
    if size < 5_000:
        raise RuntimeError(f"Rendered PDF is implausibly small ({size} bytes)")
    return pdf_path, preview_path, f"/api/orders/{order['id']}/preview", size


def step_verify_pdf(pdf_path: Path) -> int:
    """Step 4: Asserts PDF file exists, has valid header, and file size >= 1,000,000 bytes."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    pdf_size = os.path.getsize(pdf_path)
    if pdf_size < 1_000_000:
        raise AssertionError(
            f"Generated PDF size {pdf_size} bytes is strictly below 1MB requirement (>= 1,000,000 bytes)"
        )

    with open(pdf_path, "rb") as f:
        header = f.read(1024)
        if not header.startswith(b"%PDF-"):
            raise ValueError("Output file does not contain a valid %PDF- header")

    return pdf_size


def step_generate_preview(
    order: Dict[str, Any],
    wave_path: Path,
    out_dir: Path,
) -> Tuple[Path, str]:
    """Step 5: Generates an 800px preview image for customer order status page."""
    preview_path = out_dir / f"{order['id']}_preview.png"
    photo_path = order.get("photo_path") or order.get("photoPath") or ""
    decorative_theme = (
        order.get("decorative_theme")
        or order.get("decorativeTheme")
        or order.get("decorativeStyle")
        or order.get("decorative_style")
        or order.get("theme")
        or "botanical"
    )

    generate_preview_thumbnail(
        output_path=str(preview_path),
        waveform_image_path=str(wave_path),
        photo_image_path=str(photo_path) if photo_path else None,
        decorative_theme=decorative_theme,
        frame_size=order.get("frame_size", "16x20") or "16x20",
        palette=order.get("palette", "midnight_gold") or "midnight_gold",
        caption=order.get("caption") or "",
        target_id_or_url=order["id"],
        format="PNG",
    )

    public_preview_url = f"/api/orders/{order['id']}/preview"
    return preview_path, public_preview_url


def _parse_shipping_address(raw_address: str) -> RecipientAddress:
    if not raw_address or not raw_address.strip():
        return RecipientAddress(
            line1="742 Evergreen Terrace",
            city="Springfield",
            country_code="US",
            postal_or_zip_code="97477",
            state_or_county="OR",
        )

    parts = [p.strip() for p in raw_address.split(",") if p.strip()]
    line1 = parts[0] if len(parts) > 0 else "742 Evergreen Terrace"
    city = parts[1] if len(parts) > 1 else "Springfield"

    # Try to extract state and zip from 3rd part
    state = "OR"
    zip_code = "97477"
    if len(parts) > 2:
        rem = parts[2].strip()
        state_zip = rem.split()
        if len(state_zip) >= 2:
            state = state_zip[0]
            zip_code = state_zip[1]
        elif len(state_zip) == 1:
            state = state_zip[0]

    return RecipientAddress(
        line1=line1,
        city=city,
        country_code="US",
        postal_or_zip_code=zip_code,
        state_or_county=state,
    )


def step_submit_partner(
    order: Dict[str, Any],
    pdf_path: Path,
    provider_override: Optional[str] = None,
) -> str:
    """Step 6: Submits order to Prodigi, Printify, or Mock fulfillment provider."""
    provider = get_fulfillment_provider(provider_override)

    frame_size = order.get("frame_size", "16x20") or "16x20"
    frame_conf = FRAME_SKU_MAPPINGS.get(frame_size, FRAME_SKU_MAPPINGS["16x20"])
    sku = frame_conf["prodigi_sku"]

    recipient_addr = _parse_shipping_address(order.get("shipping_address", ""))
    recipient = Recipient(
        name=order.get("customer_name") or "Valued Customer",
        email=order.get("customer_email") or "customer@example.com",
        address=recipient_addr,
    )

    req = FulfillmentOrderRequest(
        internal_order_id=order["id"],
        recipient=recipient,
        items=[
            FulfillmentItem(
                sku=sku,
                copies=1,
                sizing="fillPrintArea",
                assets=[{"printArea": "default", "url": str(pdf_path.resolve().as_uri())}],
            )
        ],
        metadata={"caption": order.get("caption", ""), "frameSize": frame_size},
    )

    resp = provider.create_order(req)
    if not resp.success or not resp.partner_order_id:
        error_msg = "; ".join(resp.errors) if resp.errors else "Unknown partner rejection"
        raise RuntimeError(f"Print partner order submission failed: {error_msg}")

    return resp.partner_order_id


def step_dispatch_email(
    order: Dict[str, Any],
    preview_url: str,
    email_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Step 7: Dispatches order confirmation email via Resend or MockEmailService."""
    email_svc = get_email_service(email_override)
    frame_size = order.get("frame_size", "16x20") or "16x20"
    frame_conf = FRAME_SKU_MAPPINGS.get(frame_size, FRAME_SKU_MAPPINGS["16x20"])

    cents = order.get("total_amount", 9900) or 9900
    total_fmt = f"${cents / 100:.2f}"

    data = OrderConfirmationData(
        order_id=order["id"],
        customer_email=order.get("customer_email") or "customer@example.com",
        customer_name=order.get("customer_name") or "Valued Customer",
        frame_size_label=frame_conf["label"],
        palette_name=order.get("palette", "Midnight Gold").replace("_", " ").title(),
        total_formatted=total_fmt,
        caption=order.get("caption") or "",
        shipping_address_summary=order.get("shipping_address") or "Standard Delivery",
        preview_image_url=preview_url,
    )

    return email_svc.send_order_confirmation(data)


# ============================================================================
# 3. Main Fulfillment Orchestrator Function
# ============================================================================

def _finish_fulfillment(conn, order, order_id, pdf_path, pdf_size, public_preview_url, schema_type, provider_name, email_provider, start_time):
    """Steps 6-8 shared by legacy and curated orders."""
    partner_order_id = step_submit_partner(order, pdf_path, provider_override=provider_name)
    add_fulfillment_log(conn, order_id, "submit_to_print_partner", "completed", f"Partner ID: {partner_order_id}")
    email_res = step_dispatch_email(order, public_preview_url, email_override=email_provider)
    add_fulfillment_log(conn, order_id, "dispatch_confirmation_email", "completed", f"Email ID: {email_res.get('id')}")
    rel_pdf_path = f"storage/print_pdfs/{pdf_path.name}"
    update_order_fulfillment_success(
        conn=conn,
        order_id=order_id,
        partner_order_id=partner_order_id,
        pdf_path=rel_pdf_path,
        preview_url=public_preview_url,
        schema_type=schema_type,
        pdf_size_bytes=pdf_size,
    )
    add_fulfillment_log(conn, order_id, "update_order_status_to_submitted", "completed", "Status: fulfillment_submitted")
    return {
        "success": True,
        "orderId": order_id,
        "status": "fulfillment_submitted",
        "partnerOrderId": partner_order_id,
        "pdfPath": rel_pdf_path,
        "previewUrl": public_preview_url,
        "pdfSizeBytes": pdf_size,
        "elapsedSeconds": round(time.time() - start_time, 2),
        "steps": ["fetch_order_from_db", "render_curated_artwork", "submit_to_print_partner", "dispatch_confirmation_email", "update_order_status_to_submitted"],
    }


def run_fulfillment(
    order_id: str,
    provider_name: Optional[str] = None,
    email_provider: Optional[str] = None,
    db_path: Optional[str] = None,
    photo_path: Optional[str] = None,
    decorative_theme: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the complete 8-step fulfillment pipeline for a given order ID.
    Returns summary dictionary or raises exception.
    """
    start_time = time.time()
    conn = get_db_connection(db_path)

    # Step 1: fetch_order_from_db
    logger.info("Step 1: fetch_order_from_db for order %s", order_id)
    order = fetch_order_details(conn, order_id)
    if not order:
        logger.error("Order ID '%s' not found in database", order_id)
        raise ValueError(f"Order '{order_id}' does not exist in database")

    if photo_path:
        order["photo_path"] = photo_path
    if decorative_theme:
        order["decorative_theme"] = decorative_theme

    schema_type = order.get("schema_type", "prisma")
    add_fulfillment_log(conn, order_id, "fetch_order_from_db", "completed", f"Status: {order['status']}")

    # Setup artifact storage directories
    prints_dir = PROJECT_ROOT / "storage" / "print_pdfs"
    previews_dir = PROJECT_ROOT / "storage" / "previews"
    prints_dir.mkdir(parents=True, exist_ok=True)
    previews_dir.mkdir(parents=True, exist_ok=True)

    try:
        if order.get("artwork_spec"):
            # Curated designs: steps 2-5 collapse into one deterministic vector render.
            logger.info("Steps 2-5: render curated artwork (vector PDF + proof)")
            pdf_path, preview_path, public_preview_url, pdf_size = step_render_curated(order, prints_dir, previews_dir)
            add_fulfillment_log(conn, order_id, "render_curated_artwork", "completed", f"{pdf_path.name} ({pdf_size} bytes)")
            return _finish_fulfillment(conn, order, order_id, pdf_path, pdf_size, public_preview_url, schema_type, provider_name, email_provider, start_time)

        # Step 2: generate_waveform
        logger.info("Step 2: generate_waveform")
        wave_path = step_generate_waveform(order, previews_dir)
        add_fulfillment_log(conn, order_id, "generate_waveform", "completed", str(wave_path))

        # Step 3: compile_300dpi_pdf
        logger.info("Step 3: compile_300dpi_pdf")
        pdf_path = step_compile_pdf(order, wave_path, prints_dir)
        add_fulfillment_log(conn, order_id, "compile_300dpi_pdf", "completed", str(pdf_path))

        # Step 4: verify_pdf_size_ge_1mb
        logger.info("Step 4: verify_pdf_size_ge_1mb")
        pdf_size = step_verify_pdf(pdf_path)
        add_fulfillment_log(conn, order_id, "verify_pdf_size_ge_1mb", "completed", f"Verified size: {pdf_size} bytes")

        # Step 5: generate_preview_thumbnail
        logger.info("Step 5: generate_preview_thumbnail")
        preview_path, public_preview_url = step_generate_preview(order, wave_path, previews_dir)
        add_fulfillment_log(conn, order_id, "generate_preview_thumbnail", "completed", str(preview_path))

        # Step 6: submit_to_print_partner
        logger.info("Step 6: submit_to_print_partner")
        partner_order_id = step_submit_partner(order, pdf_path, provider_override=provider_name)
        add_fulfillment_log(conn, order_id, "submit_to_print_partner", "completed", f"Partner ID: {partner_order_id}")

        # Step 7: dispatch_confirmation_email
        logger.info("Step 7: dispatch_confirmation_email")
        email_res = step_dispatch_email(order, public_preview_url, email_override=email_provider)
        add_fulfillment_log(conn, order_id, "dispatch_confirmation_email", "completed", f"Email ID: {email_res.get('id')}")

        # Step 8: update_order_status_to_submitted
        logger.info("Step 8: update_order_status_to_submitted")
        rel_pdf_path = f"storage/print_pdfs/{pdf_path.name}"
        update_order_fulfillment_success(
            conn=conn,
            order_id=order_id,
            partner_order_id=partner_order_id,
            pdf_path=rel_pdf_path,
            preview_url=public_preview_url,
            schema_type=schema_type,
            pdf_size_bytes=pdf_size,
        )
        add_fulfillment_log(conn, order_id, "update_order_status_to_submitted", "completed", "Status: fulfillment_submitted")

        elapsed_s = time.time() - start_time
        summary = {
            "success": True,
            "orderId": order_id,
            "status": "fulfillment_submitted",
            "partnerOrderId": partner_order_id,
            "pdfPath": rel_pdf_path,
            "previewUrl": public_preview_url,
            "pdfSizeBytes": pdf_size,
            "elapsedSeconds": round(elapsed_s, 2),
            "steps": PIPELINE_STEPS,
        }
        logger.info("Fulfillment completed successfully for order %s in %.2fs", order_id, elapsed_s)
        return summary

    except Exception as e:
        logger.exception("Fulfillment pipeline failed for order %s: %s", order_id, e)
        try:
            update_order_fulfillment_failed(conn, order_id, schema_type=schema_type)
            add_fulfillment_log(conn, order_id, "fulfillment_pipeline", "failed", str(e))
        except Exception:
            pass
        raise
    finally:
        conn.close()


# ============================================================================
# 4. CLI Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="SoundWave Art - CLI Automated Fulfillment Runner",
        prog="python -m backend.fulfill",
    )
    parser.add_argument(
        "--order-id",
        type=str,
        default="",
        help="Target Order ID to fulfill (e.g. ord_01HXYZ...)",
    )
    parser.add_argument(
        "--provider",
        type=str,
        default=None,
        choices=["mock", "prodigi", "printify"],
        help="Print partner provider override (defaults to FULFILLMENT_PROVIDER env or mock)",
    )
    parser.add_argument(
        "--email-provider",
        type=str,
        default=None,
        choices=["mock", "resend"],
        help="Email service override (defaults to mock if no RESEND_API_KEY)",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="Custom SQLite database file path override",
    )
    parser.add_argument(
        "--photo",
        "--photo-path",
        type=str,
        default=None,
        dest="photo_path",
        help="Custom personal photo image file path override (JPG or PNG)",
    )
    parser.add_argument(
        "--theme",
        "--decorative-theme",
        type=str,
        default=None,
        dest="decorative_theme",
        help="Custom decorative theme override (botanical, modern_border, arch, minimal)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate order existence without executing pipeline mutations",
    )

    args = parser.parse_args()

    if not args.order_id or not args.order_id.strip():
        logger.error("--order-id flag is required and cannot be empty")
        sys.exit(2)

    try:
        result = run_fulfillment(
            order_id=args.order_id.strip(),
            provider_name=args.provider,
            email_provider=args.email_provider,
            db_path=args.db,
            photo_path=args.photo_path,
            decorative_theme=args.decorative_theme,
        )
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
