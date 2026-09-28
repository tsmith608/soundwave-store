"""
backend/preview_generator.py
Fast 800px Preview Thumbnail Generator for SoundWave Art Order Status Pages.
Generates lightweight (< 500 KB, target 30-150 KB), responsive web thumbnails:
  1. Maximum dimension strictly <= 800px.
  2. Preserves physical frame aspect ratio:
     - 8x10: 640x800 (4:5)
     - 11x14: 628x800 (11:14)
     - 16x20: 640x800 (4:5)
     - 24x36: 533x800 (2:3)
  3. Ultra-fast standalone PIL compositing engine (<50ms, zero browser dependency).
  4. Standard web delivery formats: PNG, JPEG, or WEBP.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union

from PIL import Image, ImageDraw, ImageFont, ImageOps
import qrcode

# Base project paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Frame size dimensions (max dimension 800px)
PREVIEW_SIZE_MAP: Dict[str, Tuple[int, int]] = {
    "8x10": (640, 800),     # 4:5
    "11x14": (628, 800),    # 11:14
    "16x20": (640, 800),    # 4:5
    "24x36": (533, 800),    # 2:3
}

# Standard Palette Definitions
PALETTE_COLORS: Dict[str, Dict[str, str]] = {
    "midnight_gold": {"bg": "#0c0c0c", "wave": "#d4af37", "text": "#ffffff"},
    "white_silver": {"bg": "#ffffff", "wave": "#a0a0a0", "text": "#1a1a1a"},
    "everest_silver": {"bg": "#ffffff", "wave": "#a0a0a0", "text": "#1a1a1a"},
    "dark_blue_white": {"bg": "#0f172a", "wave": "#ffffff", "text": "#ffffff"},
    "ocean_navy": {"bg": "#0f172a", "wave": "#ffffff", "text": "#ffffff"},
    "nordic_slate": {"bg": "#1a1a1a", "wave": "#fdfdfd", "text": "#fdfdfd"},
    "rose_petal": {"bg": "#fff5f5", "wave": "#ff9999", "text": "#1a1a1a"},
    "blush_rose": {"bg": "#fdf8f7", "wave": "#c87d6e", "text": "#3d2b27"},
    "botanical_sage": {"bg": "#f6f8f5", "wave": "#5b7f67", "text": "#253529"},
    "champagne_gold": {"bg": "#fcfaf6", "wave": "#c5a059", "text": "#2b261d"},
    "lavender_mist": {"bg": "#f8f6fb", "wave": "#8e82a8", "text": "#2d2738"},
}


def calculate_preview_dimensions(frame_size: str, max_dim: int = 800) -> Tuple[int, int]:
    """Computes exact width and height constrained to max_dim while matching frame aspect ratio."""
    if frame_size in PREVIEW_SIZE_MAP and max_dim == 800:
        return PREVIEW_SIZE_MAP[frame_size]

    ratio_map = {
        "8x10": 8.0 / 10.0,
        "11x14": 11.0 / 14.0,
        "16x20": 16.0 / 20.0,
        "24x36": 24.0 / 36.0,
    }
    ratio = ratio_map.get(frame_size, 0.8)
    w = int(max_dim * ratio)
    h = max_dim
    return (w, h)


def _parse_palette(palette: Union[str, Dict[str, str]]) -> Dict[str, str]:
    """Normalizes palette input into {bg, wave, text} hex color dictionary."""
    if isinstance(palette, dict):
        bg = palette.get("bg") or palette.get("paletteBg") or "#0c0c0c"
        wave = palette.get("wave") or palette.get("paletteWave") or "#d4af37"
        text = palette.get("text") or palette.get("paletteText") or wave
        return {"bg": bg, "wave": wave, "text": text}

    pal_key = str(palette).lower().strip()
    return PALETTE_COLORS.get(pal_key, PALETTE_COLORS["midnight_gold"])


def _hex_to_rgb(hex_code: str) -> Tuple[int, int, int]:
    clean = hex_code.lstrip("#")
    if len(clean) == 3:
        clean = "".join([c * 2 for c in clean])
    return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))


def _draw_theme_borders(
    draw: ImageDraw.ImageDraw,
    theme: str,
    width: int,
    height: int,
    wave_rgb: Tuple[int, int, int],
    bg_rgb: Tuple[int, int, int],
) -> None:
    """Draws theme-specific outer and inner framing borders and corner flourishes for all 8 themes."""
    b_out_x = int(width * 0.045)
    b_out_y = int(height * 0.035)
    b_in_x = int(width * 0.052)
    b_in_y = int(height * 0.042)

    if theme == "modern_border":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        ch = 8
        draw.line([(b_out_x - 3, b_out_y), (b_out_x + ch, b_out_y)], fill=wave_rgb, width=1)
        draw.line([(b_out_x, b_out_y - 3), (b_out_x, b_out_y + ch)], fill=wave_rgb, width=1)
        draw.line([(width - b_out_x - ch, b_out_y), (width - b_out_x + 3, b_out_y)], fill=wave_rgb, width=1)
        draw.line([(width - b_out_x, b_out_y - 3), (width - b_out_x, b_out_y + ch)], fill=wave_rgb, width=1)
        draw.line([(b_out_x - 3, height - b_out_y), (b_out_x + ch, height - b_out_y)], fill=wave_rgb, width=1)
        draw.line([(b_out_x, height - b_out_y - ch), (b_out_x, height - b_out_y + 3)], fill=wave_rgb, width=1)
        draw.line([(width - b_out_x - ch, height - b_out_y), (width - b_out_x + 3, height - b_out_y)], fill=wave_rgb, width=1)
        draw.line([(width - b_out_x, height - b_out_y - ch), (width - b_out_x, height - b_out_y + 3)], fill=wave_rgb, width=1)

    elif theme == "arch":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rounded_rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], radius=int(width * 0.06), outline=wave_rgb, width=1)
        for cx, cy in [(b_out_x, b_out_y), (width - b_out_x, b_out_y), (b_out_x, height - b_out_y), (width - b_out_x, height - b_out_y)]:
            draw.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], fill=wave_rgb)

    elif theme == "art_deco":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=2)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy, sx, sy in [
            (b_out_x, b_out_y, 1, 1),
            (width - b_out_x, b_out_y, -1, 1),
            (b_out_x, height - b_out_y, 1, -1),
            (width - b_out_x, height - b_out_y, -1, -1),
        ]:
            draw.line([(cx, cy + sy * 12), (cx, cy), (cx + sx * 12, cy)], fill=wave_rgb, width=2)
            draw.line([(cx + sx * 4, cy + sy * 10), (cx + sx * 4, cy + sy * 4), (cx + sx * 10, cy + sy * 4)], fill=wave_rgb, width=1)
            draw.polygon([(cx + sx * 2, cy + sy * 2), (cx + sx * 5, cy), (cx + sx * 8, cy + sy * 2), (cx + sx * 5, cy + sy * 4)], fill=wave_rgb)

    elif theme == "vintage_grunge":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy, sa, ea in [
            (b_out_x, b_out_y, 0, 90),
            (width - b_out_x, b_out_y, 90, 180),
            (b_out_x, height - b_out_y, 270, 360),
            (width - b_out_x, height - b_out_y, 180, 270),
        ]:
            for r in [6, 11, 16]:
                draw.arc([cx - r, cy - r, cx + r, cy + r], sa, ea, fill=wave_rgb, width=1)

    elif theme == "luxury_marble":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy, sx, sy in [
            (b_out_x, b_out_y, 1, 1),
            (width - b_out_x, b_out_y, -1, 1),
            (b_out_x, height - b_out_y, 1, -1),
            (width - b_out_x, height - b_out_y, -1, -1),
        ]:
            draw.line([(cx, cy + sy * 12), (cx, cy), (cx + sx * 12, cy)], fill=wave_rgb, width=2)
            draw.polygon([(cx, cy), (cx + sx * 4, cy - sy * 2), (cx + sx * 6, cy), (cx + sx * 4, cy + sy * 2)], fill=wave_rgb)

    elif theme in ("abstract_geometric", "geometric"):
        draw.line([(b_out_x, b_out_y), (width - b_out_x, b_out_y)], fill=wave_rgb, width=2)
        draw.line([(b_out_x, b_out_y), (b_out_x, height - b_out_y)], fill=wave_rgb, width=2)
        draw.line([(width - b_out_x, b_out_y), (width - b_out_x, height - b_out_y)], fill=wave_rgb, width=1)
        draw.line([(b_out_x, height - b_out_y), (width - b_out_x, height - b_out_y)], fill=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy, sa, ea, dx, dy in [
            (b_out_x, b_out_y, 0, 90, 1, 1),
            (width - b_out_x, b_out_y, 90, 180, -1, 1),
            (b_out_x, height - b_out_y, 270, 360, 1, -1),
            (width - b_out_x, height - b_out_y, 180, 270, -1, -1),
        ]:
            draw.arc([cx - 12, cy - 12, cx + 12, cy + 12], sa, ea, fill=wave_rgb, width=1)
            draw.ellipse([cx + dx * 4 - 2, cy + dy * 4 - 2, cx + dx * 4 + 2, cy + dy * 4 + 2], fill=wave_rgb)

    elif theme == "celestial":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy, dx, dy in [
            (b_out_x, b_out_y, 1, 1),
            (width - b_out_x, b_out_y, -1, 1),
            (b_out_x, height - b_out_y, 1, -1),
            (width - b_out_x, height - b_out_y, -1, -1),
        ]:
            draw.line([(cx - 6, cy), (cx + 6, cy)], fill=wave_rgb, width=1)
            draw.line([(cx, cy - 6), (cx, cy + 6)], fill=wave_rgb, width=1)
            draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=wave_rgb)
            draw.ellipse([cx + dx * 8 - 1, cy + dy * 5 - 1, cx + dx * 8 + 1, cy + dy * 5 + 1], fill=wave_rgb)

    elif theme == "minimal":
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)

    else:
        # Botanical / floral (default)
        draw.rectangle([b_out_x, b_out_y, width - b_out_x, height - b_out_y], outline=wave_rgb, width=1)
        draw.rectangle([b_in_x, b_in_y, width - b_in_x, height - b_in_y], outline=wave_rgb, width=1)
        for cx, cy in [(b_out_x, b_out_y), (width - b_out_x, b_out_y), (b_out_x, height - b_out_y), (width - b_out_x, height - b_out_y)]:
            draw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=wave_rgb)
            dx = 4 if cx == b_out_x else -4
            dy = 4 if cy == b_out_y else -4
            draw.ellipse([cx + dx - 2, cy - 1, cx + dx + 2, cy + 1], fill=wave_rgb)
            draw.ellipse([cx - 1, cy + dy - 2, cx + 1, cy + dy + 2], fill=wave_rgb)


def _draw_theme_divider(
    draw: ImageDraw.ImageDraw,
    theme: str,
    width: int,
    div_y: int,
    wave_rgb: Tuple[int, int, int],
    bg_rgb: Tuple[int, int, int],
) -> None:
    """Draws theme-specific central divider for all 8 themes."""
    cx = width // 2
    if theme in ("botanical", "floral"):
        div_len = 36
        draw.line([(cx - div_len, div_y), (cx - 8, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 8, div_y), (cx + div_len, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 3, div_y - 3), (cx + 3, div_y + 3)], fill=wave_rgb)
        draw.ellipse([(cx - 12, div_y - 2), (cx - 6, div_y + 2)], fill=wave_rgb)
        draw.ellipse([(cx + 6, div_y - 2), (cx + 12, div_y + 2)], fill=wave_rgb)
    elif theme == "modern_border":
        draw.line([(cx - 40, div_y), (cx - 6, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 6, div_y), (cx + 40, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 2, div_y - 2), (cx + 2, div_y + 2)], fill=wave_rgb)
    elif theme == "arch":
        draw.line([(cx - 45, div_y - 1), (cx + 45, div_y - 1)], fill=wave_rgb, width=1)
        draw.line([(cx - 30, div_y + 2), (cx + 30, div_y + 2)], fill=wave_rgb, width=1)
        draw.polygon([(cx, div_y - 4), (cx + 4, div_y), (cx, div_y + 4), (cx - 4, div_y)], fill=wave_rgb)
    elif theme == "art_deco":
        draw.line([(cx - 45, div_y), (cx - 14, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 14, div_y), (cx + 45, div_y)], fill=wave_rgb, width=1)
        draw.polygon([(cx, div_y - 5), (cx + 5, div_y), (cx, div_y + 5), (cx - 5, div_y)], fill=wave_rgb)
        draw.polygon([(cx - 9, div_y - 3), (cx - 6, div_y), (cx - 9, div_y + 3), (cx - 12, div_y)], fill=wave_rgb)
        draw.polygon([(cx + 9, div_y - 3), (cx + 12, div_y), (cx + 9, div_y + 3), (cx + 6, div_y)], fill=wave_rgb)
    elif theme == "vintage_grunge":
        draw.line([(cx - 42, div_y), (cx - 10, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 10, div_y), (cx + 42, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 5, div_y - 5), (cx + 5, div_y + 5)], outline=wave_rgb, width=1)
        draw.ellipse([(cx - 2, div_y - 2), (cx + 2, div_y + 2)], fill=wave_rgb)
    elif theme == "luxury_marble":
        draw.line([(cx - 45, div_y - 1), (cx + 45, div_y - 1)], fill=wave_rgb, width=1)
        draw.line([(cx - 32, div_y + 2), (cx + 32, div_y + 2)], fill=wave_rgb, width=1)
        draw.polygon([(cx, div_y - 4), (cx + 4, div_y), (cx, div_y + 4), (cx - 4, div_y)], fill=wave_rgb)
    elif theme in ("abstract_geometric", "geometric"):
        draw.line([(cx - 42, div_y), (cx - 12, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 12, div_y), (cx + 42, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 8, div_y - 3), (cx - 2, div_y + 3)], fill=wave_rgb)
        draw.ellipse([(cx + 1, div_y - 4), (cx + 7, div_y + 4)], outline=wave_rgb, width=1)
    elif theme == "celestial":
        draw.line([(cx - 45, div_y), (cx - 12, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 12, div_y), (cx + 45, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 4, div_y - 4), (cx + 4, div_y + 4)], fill=wave_rgb)
        draw.ellipse([(cx - 2, div_y - 4), (cx + 5, div_y + 3)], fill=bg_rgb)
        draw.ellipse([(cx - 10, div_y - 1), (cx - 8, div_y + 1)], fill=wave_rgb)
        draw.ellipse([(cx + 8, div_y - 1), (cx + 10, div_y + 1)], fill=wave_rgb)
    elif theme == "minimal":
        draw.line([(cx - 28, div_y), (cx + 28, div_y)], fill=wave_rgb, width=1)
    else:
        div_len = 36
        draw.line([(cx - div_len, div_y), (cx - 8, div_y)], fill=wave_rgb, width=1)
        draw.line([(cx + 8, div_y), (cx + div_len, div_y)], fill=wave_rgb, width=1)
        draw.ellipse([(cx - 2, div_y - 2), (cx + 2, div_y + 2)], fill=wave_rgb)


def generate_preview_thumbnail(
    output_path: Optional[str] = None,
    waveform_image_path: Optional[str] = None,
    photo_image_path: Optional[str] = None,
    photo_path: Optional[str] = None,
    decorative_theme: str = "botanical",
    frame_size: str = "16x20",
    palette: Union[str, Dict[str, str]] = "midnight_gold",
    caption: str = "",
    target_id_or_url: str = "preview",
    format: str = "PNG",
    quality: int = 85,
    order_data: Optional[Dict[str, Any]] = None,
    wave_image_path: Optional[str] = None,
    output_preview_path: Optional[str] = None,
) -> str:
    """
    Renders an optimized 800px preview thumbnail using pure PIL in <50ms.
    Supports direct parameter calls or dictionary invocation via order_data.
    Composites photo + soundwave + decorative accents across 8 aesthetic themes.
    """
    # Normalize order_data arguments if provided
    if order_data:
        frame_size = order_data.get("frame_size") or order_data.get("frameSize") or frame_size
        palette = order_data.get("palette") or palette
        if order_data.get("caption") is not None:
            caption = order_data["caption"]
        target_id_or_url = order_data.get("id") or target_id_or_url
        if not wave_image_path and not waveform_image_path:
            wave_image_path = order_data.get("wave_image_path") or order_data.get("waveform_image_path")
        cand_photo = (
            order_data.get("photo_image_path")
            or order_data.get("photo_path")
            or order_data.get("photoPath")
            or order_data.get("imagePath")
            or order_data.get("image_path")
        )
        if cand_photo:
            photo_image_path = cand_photo
        decorative_theme = (
            order_data.get("decorative_theme")
            or order_data.get("decorativeTheme")
            or order_data.get("decorativeStyle")
            or order_data.get("decorative_style")
            or order_data.get("theme")
            or decorative_theme
        )

    effective_output_path = output_preview_path or output_path
    if not effective_output_path:
        order_slug = target_id_or_url if target_id_or_url != "preview" else "default"
        effective_output_path = str(PROJECT_ROOT / "storage" / "previews" / f"{order_slug}_preview.png")

    effective_wave_path = wave_image_path or waveform_image_path
    effective_photo_path = photo_image_path or photo_path

    # Check for personal photo
    photo_img = None
    has_photo = False
    if effective_photo_path and os.path.exists(effective_photo_path):
        try:
            raw_photo = Image.open(effective_photo_path)
            photo_img = ImageOps.exif_transpose(raw_photo)
            has_photo = True
        except Exception:
            has_photo = False

    width, height = calculate_preview_dimensions(frame_size, max_dim=800)
    pal = _parse_palette(palette)
    bg_rgb = _hex_to_rgb(pal["bg"])
    wave_rgb = _hex_to_rgb(pal["wave"])
    text_rgb = _hex_to_rgb(pal["text"])

    # Create root canvas
    canvas = Image.new("RGB", (width, height), bg_rgb)
    draw = ImageDraw.Draw(canvas)

    theme = (decorative_theme or "botanical").lower().strip()

    # 0. Decorative Framing Borders & Corner Accents (Rendered for ALL prints)
    _draw_theme_borders(draw, theme, width, height, wave_rgb, bg_rgb)

    if has_photo and photo_img:
        # 1. Customer Personal Photo Window
        photo_box_w = int(width * 0.74)
        photo_box_h = int(height * 0.36)
        photo_x = (width - photo_box_w) // 2
        photo_y = int(height * 0.065)

        fitted_photo = ImageOps.fit(photo_img, (photo_box_w, photo_box_h), method=Image.Resampling.LANCZOS)
        if fitted_photo.mode != "RGB":
            fitted_photo = fitted_photo.convert("RGB")

        if theme in ("arch", "luxury_marble"):
            # Elegant arched top photo mat frame
            arch_mask = Image.new("L", (photo_box_w, photo_box_h), 0)
            arch_draw = ImageDraw.Draw(arch_mask)
            arch_radius = int(photo_box_w * 0.38)
            arch_draw.rounded_rectangle([0, 0, photo_box_w, photo_box_h], radius=arch_radius, fill=255)
            canvas.paste(fitted_photo, (photo_x, photo_y), mask=arch_mask)
            draw.rounded_rectangle(
                [photo_x - 1, photo_y - 1, photo_x + photo_box_w + 1, photo_y + photo_box_h + 1],
                radius=arch_radius,
                outline=wave_rgb,
                width=1,
            )
        elif theme == "art_deco":
            canvas.paste(fitted_photo, (photo_x, photo_y))
            draw.rectangle(
                [photo_x - 1, photo_y - 1, photo_x + photo_box_w + 1, photo_y + photo_box_h + 1],
                outline=wave_rgb,
                width=2,
            )
        elif theme in ("abstract_geometric", "geometric"):
            canvas.paste(fitted_photo, (photo_x, photo_y))
            draw.rectangle(
                [photo_x - 1, photo_y - 1, photo_x + photo_box_w + 1, photo_y + photo_box_h + 1],
                outline=wave_rgb,
                width=2,
            )
        elif theme == "celestial":
            arch_mask = Image.new("L", (photo_box_w, photo_box_h), 0)
            arch_draw = ImageDraw.Draw(arch_mask)
            arch_draw.rounded_rectangle([0, 0, photo_box_w, photo_box_h], radius=8, fill=255)
            canvas.paste(fitted_photo, (photo_x, photo_y), mask=arch_mask)
            draw.rounded_rectangle(
                [photo_x - 1, photo_y - 1, photo_x + photo_box_w + 1, photo_y + photo_box_h + 1],
                radius=8,
                outline=wave_rgb,
                width=1,
            )
        else:
            canvas.paste(fitted_photo, (photo_x, photo_y))
            draw.rectangle(
                [photo_x - 1, photo_y - 1, photo_x + photo_box_w + 1, photo_y + photo_box_h + 1],
                outline=wave_rgb,
                width=1,
            )

        # 2. Soundwave Section (below photo)
        wave_top = photo_y + photo_box_h + int(height * 0.02)
        wave_height = int(height * 0.16)
        wave_width = int(width * 0.82)
        wave_left = int((width - wave_width) / 2)

        pasted_wave = False
        if effective_wave_path and os.path.exists(effective_wave_path):
            try:
                wf_img = Image.open(effective_wave_path).convert("RGBA")
                wf_img.thumbnail((wave_width, wave_height), Image.Resampling.LANCZOS)
                paste_x = wave_left + (wave_width - wf_img.width) // 2
                paste_y = wave_top + (wave_height - wf_img.height) // 2
                canvas.paste(wf_img, (paste_x, paste_y), mask=wf_img)
                pasted_wave = True
            except Exception:
                pasted_wave = False

        if not pasted_wave:
            num_bars = 64
            unit = wave_width / num_bars
            bar_w = max(2, int(unit * 0.65))
            mid_y = wave_top + wave_height // 2
            for i in range(num_bars):
                bx = int(wave_left + i * unit)
                sin_val = abs(math.sin(i * 0.22) * math.cos(i * 0.08))
                bh = max(3, int((wave_height * 0.42) * (0.15 + 0.85 * sin_val)))
                draw.rounded_rectangle(
                    [bx, mid_y - bh, bx + bar_w, mid_y + bh],
                    radius=bar_w // 2,
                    fill=wave_rgb,
                )

        # 3. Theme Divider (below waveform)
        div_y = wave_top + wave_height + int(height * 0.018)
        _draw_theme_divider(draw, theme, width, div_y, wave_rgb, bg_rgb)

        caption_y = div_y + int(height * 0.04)
        qr_dim = int(min(width, height) * 0.10)
        qr_y = caption_y + int(height * 0.04)

    else:
        # Hero Waveform Mode (soundwave-only prints)
        wave_top = int(height * 0.12)
        wave_height = int(height * 0.44)
        wave_width = int(width * 0.84)
        wave_left = int((width - wave_width) / 2)

        pasted_wave = False
        if effective_wave_path and os.path.exists(effective_wave_path):
            try:
                wf_img = Image.open(effective_wave_path).convert("RGBA")
                wf_img.thumbnail((wave_width, wave_height), Image.Resampling.LANCZOS)
                paste_x = wave_left + (wave_width - wf_img.width) // 2
                paste_y = wave_top + (wave_height - wf_img.height) // 2
                canvas.paste(wf_img, (paste_x, paste_y), mask=wf_img)
                pasted_wave = True
            except Exception:
                pasted_wave = False

        if not pasted_wave:
            # Fallback: Render clean pill bars
            num_bars = 64
            unit = wave_width / num_bars
            bar_w = max(2, int(unit * 0.65))
            mid_y = wave_top + wave_height // 2

            for i in range(num_bars):
                bx = int(wave_left + i * unit)
                sin_val = abs(math.sin(i * 0.22) * math.cos(i * 0.08))
                bh = max(4, int((wave_height * 0.42) * (0.15 + 0.85 * sin_val)))
                draw.rounded_rectangle(
                    [bx, mid_y - bh, bx + bar_w, mid_y + bh],
                    radius=bar_w // 2,
                    fill=wave_rgb,
                )

        # Theme Divider (below hero waveform)
        div_y = wave_top + wave_height + int(height * 0.024)
        _draw_theme_divider(draw, theme, width, div_y, wave_rgb, bg_rgb)

        caption_y = div_y + int(height * 0.04)
        qr_dim = int(min(width, height) * 0.11)
        qr_y = caption_y + int(height * 0.05)

    # 4. Centered Inscription Caption
    if caption:
        caption_clean = caption.strip()
        if len(caption_clean) <= 30:
            font_size = 22 if has_photo else 24
        elif len(caption_clean) <= 60:
            font_size = 16 if has_photo else 18
        else:
            font_size = 13 if has_photo else 14

        font = None
        # Try local fonts, system fonts, or default
        local_font_paths = [
            BACKEND_DIR / "assets" / "fonts" / "GreatVibes-Regular.ttf",
            Path("C:/Windows/Fonts/georgia.ttf"),
            Path("C:/Windows/Fonts/arial.ttf"),
        ]
        for fp in local_font_paths:
            if fp.exists():
                try:
                    font = ImageFont.truetype(str(fp), font_size)
                    break
                except Exception:
                    continue

        if font is None:
            try:
                font = ImageFont.load_default()
            except Exception:
                font = None

        if font:
            draw.text(
                (width // 2, caption_y),
                caption_clean,
                fill=text_rgb,
                anchor="mm",
                font=font,
            )
        else:
            draw.text(
                (width // 2, caption_y),
                caption_clean,
                fill=text_rgb,
                anchor="mm",
            )

    # 5. Footer QR Code
    target_str = str(target_id_or_url)
    if target_str.startswith("http://") or target_str.startswith("https://"):
        qr_url = target_str
    else:
        base_url = (
            os.environ.get("NEXT_PUBLIC_APP_URL")
            or os.environ.get("APP_URL")
            or os.environ.get("SOUNDWAVE_BASE_URL", "http://localhost:3000")
        ).rstrip("/")
        qr_url = f"{base_url}/play/{target_str.lstrip('/')}"

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=3,
        border=1,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#000000", back_color="#ffffff").convert("RGB")
    qr_img = qr_img.resize((qr_dim, qr_dim), Image.Resampling.NEAREST)

    qr_x = (width - qr_dim) // 2
    canvas.paste(qr_img, (qr_x, qr_y))

    # Scan hint text
    hint_font = None
    try:
        hint_font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 9 if has_photo else 10)
    except Exception:
        try:
            hint_font = ImageFont.load_default()
        except Exception:
            pass

    if hint_font:
        draw.text(
            (width // 2, qr_y + qr_dim + (11 if has_photo else 14)),
            "SCAN TO LISTEN",
            fill=wave_rgb,
            anchor="mm",
            font=hint_font,
        )
    else:
        draw.text(
            (width // 2, qr_y + qr_dim + (11 if has_photo else 14)),
            "SCAN TO LISTEN",
            fill=wave_rgb,
            anchor="mm",
        )

    # 6. Save and Optimize Image (< 500 KB)
    out_obj = Path(effective_output_path)
    out_obj.parent.mkdir(parents=True, exist_ok=True)

    # Determine save format
    fmt = format.upper()
    if out_obj.suffix.lower() in [".jpg", ".jpeg"]:
        fmt = "JPEG"
    elif out_obj.suffix.lower() == ".webp":
        fmt = "WEBP"
    elif out_obj.suffix.lower() == ".png":
        fmt = "PNG"

    if fmt == "PNG":
        canvas.save(str(out_obj), format="PNG", optimize=True)
    elif fmt == "WEBP":
        canvas.save(str(out_obj), format="WEBP", quality=quality)
    else:
        canvas.save(str(out_obj), format="JPEG", quality=quality, optimize=True)

    file_bytes = out_obj.stat().st_size
    if file_bytes >= 500_000:
        # Re-save with lower quality to guarantee < 500 KB limit
        canvas.save(str(out_obj), format="JPEG", quality=70, optimize=True)

    return str(out_obj.resolve())


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate 800px Preview Thumbnail")
    parser.add_argument("--output", required=True, help="Output image file path")
    parser.add_argument("--waveform", default=None, help="Waveform PNG path")
    parser.add_argument("--photo", "--photo-path", default=None, dest="photo", help="Personal photo path (JPG or PNG)")
    parser.add_argument("--theme", default="botanical", help="Decorative aesthetic theme (botanical, modern_border, arch, art_deco, vintage_grunge, luxury_marble, abstract_geometric, celestial)")
    parser.add_argument("--size", default="16x20", choices=list(PREVIEW_SIZE_MAP.keys()), help="Frame size")
    parser.add_argument("--palette", default="midnight_gold", choices=list(PALETTE_COLORS.keys()), help="Palette")
    parser.add_argument("--caption", default="Our Wedding Vows", help="Custom caption")
    parser.add_argument("--target-id", default="sample_123", help="Audio ID or Order ID")

    args = parser.parse_args()
    out = generate_preview_thumbnail(
        output_path=args.output,
        waveform_image_path=args.waveform,
        photo_image_path=args.photo,
        decorative_theme=args.theme,
        frame_size=args.size,
        palette=args.palette,
        caption=args.caption,
        target_id_or_url=args.target_id,
    )
    print(f"Preview thumbnail generated: {out} ({os.path.getsize(out)} bytes)")
