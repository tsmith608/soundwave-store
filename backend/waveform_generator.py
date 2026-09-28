"""
backend/waveform_generator.py
SoundWave Art Fulfillment Engine — Waveform Generation & Audio Peak Decimation.

Features:
- Fast vectorized peak decimation (<20ms for standard audio, <100ms for 30m audio)
- Discrete rounded pill bars (60-120 bars) matching storefront customizer
- Continuous DAW-style wave modes (spikes and smoothed polygon envelope)
- 300 DPI print-ready high resolution (up to 4800px+ wide)
- Configurable palettes (Midnight Gold, Everest Silver, Ocean Navy, Nordic Slate, Rose Petal)
- Transparent RGBA background support for seamless poster compositing
- Elevation / amplitude scaling parameter (0.5x to 1.5x)
- Digital silence, micro-audio, and zero-division guards
"""

from dataclasses import dataclass
import io
import math
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import wave

import numpy as np
from PIL import Image, ImageColor, ImageDraw
from pydub import AudioSegment

# Authoritative Color Palettes
PALETTES: Dict[str, Dict[str, str]] = {
    "midnight_gold": {
        "id": "midnight_gold",
        "name": "Midnight Gold",
        "bg": "#0c0c0c",
        "wave": "#d4af37",
    },
    "everest_silver": {
        "id": "everest_silver",
        "name": "Everest Silver",
        "bg": "#ffffff",
        "wave": "#a0a0a0",
    },
    "white_silver": {  # Alias for everest_silver
        "id": "white_silver",
        "name": "White / Silver",
        "bg": "#ffffff",
        "wave": "#a0a0a0",
    },
    "ocean_navy": {
        "id": "ocean_navy",
        "name": "Ocean Navy",
        "bg": "#0f172a",
        "wave": "#ffffff",
    },
    "dark_blue_white": {  # Alias for ocean_navy
        "id": "dark_blue_white",
        "name": "Dark Blue / White",
        "bg": "#0f172a",
        "wave": "#ffffff",
    },
    "nordic_slate": {
        "id": "nordic_slate",
        "name": "Nordic Slate",
        "bg": "#1a1a1a",
        "wave": "#fdfdfd",
    },
    "rose_petal": {
        "id": "rose_petal",
        "name": "Rose Petal",
        "bg": "#fff5f5",
        "wave": "#ff9999",
    },
}


@dataclass
class WaveformConfig:
    width: int = 3886
    height: int = 661
    style: str = "pill_bars"  # "pill_bars", "daw_spikes", "daw_continuous"
    num_bars: int = 80
    gap_ratio: float = 0.4  # gap as fraction of bar width (0.4 gives 40% gap)
    scale: float = 1.0  # elevation / amplitude scaling (0.5 to 1.5)
    palette: str = "midnight_gold"
    wave_color: Optional[str] = None  # overrides palette wave color
    bg_color: Optional[str] = None  # overrides palette bg color
    transparent_bg: bool = False  # when True, renders alpha 0 background
    min_elevation: float = 0.05  # minimum normalized elevation for quiet/silence


def load_audio_samples(
    audio_source: Union[str, Path, bytes, io.BytesIO]
) -> Tuple[np.ndarray, float]:
    """
    Loads audio from a file path or byte buffer, downmixes to mono int16 array,
    and returns (samples_array, duration_seconds).
    Fast-paths PCM WAV via native wave module; delegates to pydub for MP3/others.
    """
    if isinstance(audio_source, (str, Path)):
        path = Path(audio_source)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {path}")

        # Fast path: uncompressed PCM WAV
        if path.suffix.lower() == ".wav":
            try:
                with wave.open(str(path), "rb") as wf:
                    n_channels = wf.getnchannels()
                    sampwidth = wf.getsampwidth()
                    framerate = wf.getframerate()
                    n_frames = wf.getnframes()
                    duration = n_frames / float(framerate) if framerate > 0 else 0.0
                    raw_bytes = wf.readframes(n_frames)

                    if sampwidth == 2:
                        samples = np.frombuffer(raw_bytes, dtype=np.int16)
                        if n_channels > 1:
                            samples = samples.reshape(-1, n_channels).mean(axis=1).astype(np.int16)
                        return samples, duration
            except Exception:
                pass  # Fall back to pydub if wave parser encounters non-PCM metadata

        seg = AudioSegment.from_file(str(path))
    elif isinstance(audio_source, bytes):
        bio = io.BytesIO(audio_source)
        seg = AudioSegment.from_file(bio)
    elif isinstance(audio_source, io.BytesIO):
        seg = AudioSegment.from_file(audio_source)
    else:
        raise TypeError(f"Unsupported audio source type: {type(audio_source)}")

    duration = seg.duration_seconds
    seg = seg.set_channels(1)
    samples = np.array(seg.get_array_of_samples(), dtype=np.int16)
    return samples, duration


def extract_normalized_peaks(
    samples: Union[np.ndarray, List[int], List[float]],
    num_bars: int = 80,
    min_elevation: float = 0.05,
) -> np.ndarray:
    """
    Vectorized decimation of audio samples into normalized peak bars in [min_elevation, 1.0].
    Handles silence, micro-audio (<num_bars samples), and extreme durations (30+ min).
    """
    if not isinstance(samples, np.ndarray):
        if not samples:
            return np.full(num_bars, min_elevation, dtype=np.float32)
        samples = np.array(samples, dtype=np.float32)

    if len(samples) == 0:
        return np.full(num_bars, min_elevation, dtype=np.float32)

    abs_samples = np.abs(samples)
    global_peak = np.max(abs_samples)

    # Pure silence guard: avoid ZeroDivisionError
    if global_peak == 0:
        return np.full(num_bars, min_elevation, dtype=np.float32)

    n = len(samples)
    if n < num_bars:
        # Micro-audio: smooth interpolation over available sample points
        x_old = np.linspace(0, 1, n)
        x_new = np.linspace(0, 1, num_bars)
        peaks = np.interp(x_new, x_old, abs_samples).astype(np.float32)
    else:
        # High-performance chunking
        chunk_size = n // num_bars
        truncated_len = chunk_size * num_bars
        chunks = abs_samples[:truncated_len].reshape(num_bars, chunk_size)
        peaks = np.max(chunks, axis=1).astype(np.float32)
        if truncated_len < n:
            peaks[-1] = max(peaks[-1], np.max(abs_samples[truncated_len:]))

    normalized = peaks / float(global_peak)
    return np.clip(normalized, min_elevation, 1.0)


def _parse_rgba(
    color_val: Optional[Union[str, Tuple]],
    default_color: str = "#000000"
) -> Tuple[int, int, int, int]:
    """Parses color string or tuple into RGBA 4-tuple."""
    if color_val is None or color_val == "transparent":
        return (0, 0, 0, 0)
    if isinstance(color_val, tuple):
        if len(color_val) == 4:
            return color_val
        elif len(color_val) == 3:
            return (color_val[0], color_val[1], color_val[2], 255)
    if isinstance(color_val, str):
        if color_val.lower() == "transparent":
            return (0, 0, 0, 0)
        rgb = ImageColor.getrgb(color_val)
        if len(rgb) == 4:
            return rgb
        return (rgb[0], rgb[1], rgb[2], 255)
    rgb = ImageColor.getrgb(default_color)
    return (rgb[0], rgb[1], rgb[2], 255)


def render_pill_bars(
    peaks: np.ndarray,
    config: WaveformConfig,
) -> Image.Image:
    """
    Renders discrete rounded pill bars matching frontend WaveformCanvas.tsx.
    - Symmetrically centered vertically about height / 2.
    - Proportional bar width and gap spacing.
    - Corner radius = bar_width / 2 (full stadium capsule).
    - Minimum height is clamped to bar_width (forming a perfect circle/dot for silence).
    """
    w = config.width
    h = config.height
    num_bars = len(peaks)
    gap_ratio = config.gap_ratio

    pal = PALETTES.get(config.palette, PALETTES["midnight_gold"])
    wave_hex = config.wave_color or pal["wave"]
    wave_rgba = _parse_rgba(wave_hex, "#d4af37")

    if config.transparent_bg or config.bg_color == "transparent":
        bg_rgba = (0, 0, 0, 0)
    elif config.bg_color is not None:
        bg_rgba = _parse_rgba(config.bg_color, "#000000")
    else:
        bg_rgba = _parse_rgba(pal["bg"], "#0c0c0c")

    img = Image.new("RGBA", (w, h), bg_rgba)
    draw = ImageDraw.Draw(img)

    total_gaps = num_bars - 1
    bar_width = w / (num_bars + total_gaps * gap_ratio)
    gap_width = bar_width * gap_ratio
    radius = bar_width / 2.0

    scale = max(0.1, min(2.0, config.scale))
    max_draw_height = h * 0.90  # 5% margin top and bottom

    for i in range(num_bars):
        peak = peaks[i]
        raw_h = peak * scale * max_draw_height
        # Clamped so bar_height >= bar_width to ensure valid circular/capsule curvature
        bar_height = max(bar_width, min(h, raw_h))

        x1 = i * (bar_width + gap_width)
        x2 = x1 + bar_width
        y1 = (h - bar_height) / 2.0
        y2 = y1 + bar_height

        draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=wave_rgba)

    return img


def render_daw_spikes(
    samples: np.ndarray,
    config: WaveformConfig,
) -> Image.Image:
    """
    Renders high-density continuous DAW-style vertical spikes across image width.
    """
    w = config.width
    h = config.height

    pal = PALETTES.get(config.palette, PALETTES["midnight_gold"])
    wave_hex = config.wave_color or pal["wave"]
    wave_rgba = _parse_rgba(wave_hex, "#d4af37")

    if config.transparent_bg or config.bg_color == "transparent":
        bg_rgba = (0, 0, 0, 0)
    elif config.bg_color is not None:
        bg_rgba = _parse_rgba(config.bg_color, "#000000")
    else:
        bg_rgba = _parse_rgba(pal["bg"], "#0c0c0c")

    img = Image.new("RGBA", (w, h), bg_rgba)
    draw = ImageDraw.Draw(img)

    mid = h // 2
    max_half_h = (h / 2.0) * 0.90 * config.scale
    peaks = extract_normalized_peaks(samples, num_bars=w, min_elevation=0.02)

    for x in range(w):
        half_bar = int(peaks[x] * max_half_h)
        if half_bar < 1:
            half_bar = 1
        y1 = max(0, mid - half_bar)
        y2 = min(h - 1, mid + half_bar)
        draw.line([(x, y1), (x, y2)], fill=wave_rgba, width=1)

    return img


def render_daw_continuous(
    samples: np.ndarray,
    config: WaveformConfig,
) -> Image.Image:
    """
    Renders continuous DAW-style smooth polygon envelope.
    """
    w = config.width
    h = config.height

    pal = PALETTES.get(config.palette, PALETTES["midnight_gold"])
    wave_hex = config.wave_color or pal["wave"]
    wave_rgba = _parse_rgba(wave_hex, "#d4af37")

    if config.transparent_bg or config.bg_color == "transparent":
        bg_rgba = (0, 0, 0, 0)
    elif config.bg_color is not None:
        bg_rgba = _parse_rgba(config.bg_color, "#000000")
    else:
        bg_rgba = _parse_rgba(pal["bg"], "#0c0c0c")

    img = Image.new("RGBA", (w, h), bg_rgba)
    draw = ImageDraw.Draw(img)

    mid = h // 2
    max_half_h = (h / 2.0) * 0.90 * config.scale
    peaks = extract_normalized_peaks(samples, num_bars=w, min_elevation=0.02)

    kernel = np.ones(5, dtype=np.float32) / 5.0
    smooth_peaks = np.convolve(peaks, kernel, mode="same")
    smooth_peaks = np.clip(smooth_peaks, 0.02, 1.0)

    top_points = []
    bot_points = []
    for x in range(w):
        half_bar = int(smooth_peaks[x] * max_half_h)
        if half_bar < 1:
            half_bar = 1
        top_points.append((x, max(0, mid - half_bar)))
        bot_points.append((x, min(h - 1, mid + half_bar)))

    polygon_points = top_points + list(reversed(bot_points))
    draw.polygon(polygon_points, fill=wave_rgba)

    return img


def generate_waveform_image(
    audio_source: Optional[Union[str, Path, bytes, io.BytesIO, np.ndarray]] = None,
    config: Optional[WaveformConfig] = None,
    audio_path: Optional[str] = None,
    output_path: Optional[str] = None,
    palette: Optional[str] = None,
    frame_size: Optional[str] = None,
    style: Optional[str] = None,
    bars: Optional[int] = None,
    scale: Optional[float] = None,
    transparent_bg: Optional[bool] = None,
) -> Image.Image:
    """
    Primary image generation entrypoint.
    Supports flexible arguments:
    - audio_source / audio_path: file path, bytes, BytesIO, or numpy array.
    - config: WaveformConfig or individual parameter overrides.
    - If output_path is supplied, saves to disk in addition to returning Image.
    """
    source = audio_source if audio_source is not None else audio_path
    if source is None:
        raise ValueError("Either audio_source or audio_path must be provided")

    if config is None:
        config = WaveformConfig()

    # Apply keyword overrides
    if palette:
        config.palette = palette
    if style:
        config.style = style
    if bars is not None:
        config.num_bars = bars
    if scale is not None:
        config.scale = scale
    if transparent_bg is not None:
        config.transparent_bg = transparent_bg

    if isinstance(source, (list, tuple)):
        samples = np.array(source, dtype=np.float32)
    elif isinstance(source, np.ndarray):
        samples = source
    else:
        samples, _ = load_audio_samples(source)

    if config.style in ("pill_bars", "bars", "daw_bars"):
        peaks = extract_normalized_peaks(
            samples, num_bars=config.num_bars, min_elevation=config.min_elevation
        )
        img = render_pill_bars(peaks, config)
    elif config.style in ("daw_spikes", "daw"):
        img = render_daw_spikes(samples, config)
    elif config.style in ("daw_continuous", "envelope"):
        img = render_daw_continuous(samples, config)
    else:
        raise ValueError(
            f"Unknown waveform style: '{config.style}'. "
            f"Supported styles: 'pill_bars', 'daw_spikes', 'daw_continuous'."
        )

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        img.save(str(out_p), format="PNG", compress_level=6)

    return img


def generate_waveform(
    audio_source: Union[str, Path, bytes, io.BytesIO],
    output_path: Union[str, Path],
    config: Optional[WaveformConfig] = None,
) -> Path:
    """
    Generates waveform image and saves to output_path.
    Returns the resolved output Path.
    """
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    img = generate_waveform_image(audio_source, config)
    img.save(str(out_p), format="PNG", compress_level=6)
    return out_p


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="SoundWave Art Waveform Generator CLI")
    parser.add_argument("audio_path", type=str, help="Path to input audio file")
    parser.add_argument("-o", "--output", type=str, default="waveform.png", help="Output PNG path")
    parser.add_argument("--style", type=str, default="pill_bars", choices=["pill_bars", "daw_spikes", "daw_continuous"], help="Waveform rendering style")
    parser.add_argument("--palette", type=str, default="midnight_gold", help="Palette name")
    parser.add_argument("--bars", type=int, default=80, help="Number of discrete pill bars")
    parser.add_argument("--scale", type=float, default=1.0, help="Elevation scale multiplier (0.5 to 1.5)")
    parser.add_argument("--width", type=int, default=3886, help="Width in pixels")
    parser.add_argument("--height", type=int, default=661, help="Height in pixels")
    parser.add_argument("--transparent", action="store_true", help="Render transparent background")

    args = parser.parse_args()
    cfg = WaveformConfig(
        width=args.width,
        height=args.height,
        style=args.style,
        num_bars=args.bars,
        scale=args.scale,
        palette=args.palette,
        transparent_bg=args.transparent,
    )

    t0 = time.perf_counter()
    res = generate_waveform(args.audio_path, args.output, cfg)
    t1 = time.perf_counter()
    print(f"Generated waveform saved to {res} in {(t1 - t0)*1000:.2f}ms")
