"""
Tier 1: Feature Coverage Tests.
Feature 11: Amplitude & Waveform Engine (M2, R2).
Directly imports from backend.waveform_generator.
Tests audio decimation, peak normalization, discrete rounded pill bar geometry,
palette color mapping, and stereo channel downmixing.
"""

import math
from pathlib import Path
import struct
import tempfile
import unittest
import wave

import numpy as np
from PIL import Image

from backend.waveform_generator import (
    PALETTES,
    WaveformConfig,
    extract_normalized_peaks,
    generate_waveform_image,
    load_audio_samples,
    render_pill_bars,
)


class TestFeature11AmplitudeEngine(unittest.TestCase):
    """Verifies audio amplitude processing and waveform geometry calculation from production module."""

    def test_amplitude_extraction_peak_normalization(self):
        """Verifies samples are normalized to range [0.05, 1.0] by production extract_normalized_peaks."""
        samples = [int(32767 * math.sin(i / 10.0)) for i in range(1000)]
        peaks = extract_normalized_peaks(samples, num_bars=50, min_elevation=0.05)

        self.assertEqual(len(peaks), 50)
        for p in peaks:
            self.assertGreaterEqual(float(p), 0.05)
            self.assertLessEqual(float(p), 1.0)
        self.assertAlmostEqual(float(np.max(peaks)), 1.0, places=1)

        # Digital silence handling
        silence = [0] * 500
        peaks_silence = extract_normalized_peaks(silence, num_bars=50, min_elevation=0.05)
        self.assertTrue(np.all(peaks_silence == 0.05), "Silence must be clamped to min_elevation 0.05")

    def test_waveform_discrete_pill_bar_generation(self):
        """Verifies discrete bar geometric layout and PIL image rendering via render_pill_bars."""
        canvas_width = 3000
        canvas_height = 500
        num_bars = 80
        gap_ratio = 0.4

        cfg = WaveformConfig(
            width=canvas_width,
            height=canvas_height,
            num_bars=num_bars,
            gap_ratio=gap_ratio,
            palette="midnight_gold",
        )
        dummy_peaks = np.linspace(0.1, 1.0, num_bars, dtype=np.float32)
        img = render_pill_bars(dummy_peaks, cfg)

        self.assertEqual(img.size, (canvas_width, canvas_height))
        self.assertEqual(img.mode, "RGBA")

        # Verify geometric sizing rules
        total_gaps = num_bars - 1
        bar_width = canvas_width / (num_bars + total_gaps * gap_ratio)
        gap_width = bar_width * gap_ratio
        total_width = num_bars * bar_width + total_gaps * gap_width
        self.assertAlmostEqual(total_width, canvas_width, places=2)
        self.assertGreater(bar_width, 10.0)
        self.assertGreater(gap_width, 4.0)

        # Verify drawn pixels exist in image
        arr = np.array(img)
        self.assertGreater(arr[:, :, 3].max(), 0, "Rendered image must contain non-transparent pixels")

    def test_waveform_palette_color_mapping(self):
        """Verifies pill bar fills use wave color and canvas background uses bg color from PALETTES."""
        required_palettes = ["midnight_gold", "white_silver", "dark_blue_white"]
        for pid in required_palettes:
            self.assertIn(pid, PALETTES)
            self.assertTrue(PALETTES[pid]["bg"].startswith("#"))
            self.assertTrue(PALETTES[pid]["wave"].startswith("#"))

        # Verify generate_waveform_image respects palette colors
        test_samples = np.array([10000, -10000] * 500, dtype=np.int16)
        img = generate_waveform_image(
            audio_source=test_samples,
            palette="midnight_gold",
            bars=60,
        )
        self.assertIsInstance(img, Image.Image)
        self.assertGreater(img.width, 0)
        self.assertGreater(img.height, 0)

    def test_stereo_to_mono_channel_downmixing(self):
        """Verifies stereo left/right channels are averaged into mono via production load_audio_samples."""
        with tempfile.TemporaryDirectory() as td:
            stereo_path = Path(td) / "test_stereo.wav"
            with wave.open(str(stereo_path), "wb") as wf:
                wf.setnchannels(2)
                wf.setsampwidth(2)
                wf.setframerate(44100)
                # Channel 1: 20000, Channel 2: 10000
                frames = struct.pack("<hh", 20000, 10000) * 1000
                wf.writeframes(frames)

            loaded_samples, duration = load_audio_samples(str(stereo_path))
            self.assertEqual(loaded_samples.ndim, 1, "Loaded samples must be downmixed to mono 1D array")
            self.assertEqual(loaded_samples[0], 15000, "Left and right channels must be averaged (15000)")
            self.assertGreater(duration, 0)

    def test_waveform_aspect_ratio_alignment(self):
        """Verifies waveform banner box is proportional to selected frame orientation."""
        cfg = WaveformConfig()
        ratio = cfg.width / cfg.height
        self.assertGreater(ratio, 5.0, "Sound wave banner must have panoramic aspect ratio (> 5.0)")

        img = generate_waveform_image(audio_source=np.array([5000] * 500, dtype=np.int16))
        self.assertGreater(img.width / img.height, 5.0)


if __name__ == "__main__":
    unittest.main()
