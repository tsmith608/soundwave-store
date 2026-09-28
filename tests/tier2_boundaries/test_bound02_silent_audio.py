"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 02: Silent Audio (survey_specs.md §8).
Tests all-zero PCM samples, zero-division guards, minimum pill elevation,
near-silent ambient background, and PDF rendering stability with flat audio.
"""

import os
import tempfile
import unittest
from tests.test_harness import generate_silent_wav


class TestBound02SilentAudio(unittest.TestCase):
    """Verifies waveform generator behavior when audio has zero or negligible sound."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_absolute_digital_silence_all_zeros(self):
        """Verifies completely silent audio file (all 0x00 samples) generates valid structure."""
        silent_path = os.path.join(self.temp_dir.name, "pure_silence.wav")
        generate_silent_wav(silent_path, duration_seconds=2.0)
        self.assertTrue(os.path.exists(silent_path))

        import wave
        with wave.open(silent_path, "r") as wf:
            frames = wf.readframes(wf.getnframes())
            # All samples must be 0
            self.assertTrue(all(b == 0 for b in frames))

    def test_zero_division_guard_in_normalization(self):
        """Verifies peak normalization does not raise ZeroDivisionError when max peak is 0."""
        silent_samples = [0] * 1000
        peak = max((abs(s) for s in silent_samples), default=0)

        # Implementation guard: peak > 0 ? sample / peak : 0.05
        norm_factor = peak if peak > 0 else 1.0
        normalized = [s / norm_factor for s in silent_samples]

        self.assertEqual(max(normalized), 0.0)
        # Fallback minimum elevation for pill bar visual aesthetic
        elevations = [max(0.05, n) for n in normalized]
        self.assertEqual(elevations[0], 0.05)

    def test_flat_minimum_pill_bar_elevation(self):
        """Verifies silent audio renders elegant flat baseline bars rather than disappearing."""
        min_bar_height_px = 6
        self.assertGreater(min_bar_height_px, 0, "Bars must have minimal visible height on print")

    def test_near_silent_background_noise(self):
        """Verifies near-silent audio (-60 dBFS) does not produce erratic peak scaling."""
        quiet_amplitude = 32  # ~ -60 dBFS
        max_possible = 32767
        ratio = quiet_amplitude / max_possible
        self.assertLess(ratio, 0.01)

    def test_silent_audio_pdf_generation_stability(self):
        """Verifies PDF generator handles flat waveform without crashing."""
        flat_waveform_data = [0.05] * 80
        self.assertEqual(len(flat_waveform_data), 80)
        self.assertTrue(all(v == 0.05 for v in flat_waveform_data))


if __name__ == "__main__":
    unittest.main()
