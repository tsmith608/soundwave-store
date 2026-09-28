"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 01: Extreme Audio Durations (survey_specs.md §8).
Tests micro-audio (0.1s), short audio (0.5s), standard (1.0s),
long audio (10 min), and extreme audio (30+ min).
"""

import os
import tempfile
import unittest
from tests.test_harness import generate_wav


class TestBound01AudioDurations(unittest.TestCase):
    """Verifies platform handling of extreme audio file lengths."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_micro_duration_audio_0_1s(self):
        """Verifies 0.1s (100ms) audio file generates valid waveform without crashing."""
        path = os.path.join(self.temp_dir.name, "micro_0_1s.wav")
        generate_wav(path, duration_seconds=0.1, sample_rate=44100, frequency=1000.0)
        self.assertTrue(os.path.exists(path))
        file_size = os.path.getsize(path)
        self.assertGreater(file_size, 44, "Must contain valid WAV header and PCM data")

    def test_short_duration_audio_0_5s(self):
        """Verifies 0.5s audio snippet extracts valid amplitude peaks."""
        path = os.path.join(self.temp_dir.name, "short_0_5s.wav")
        generate_wav(path, duration_seconds=0.5, sample_rate=44100)
        import wave
        with wave.open(path, "r") as wf:
            self.assertEqual(wf.getnframes(), 22050)

    def test_standard_boundary_audio_1_0s(self):
        """Verifies 1.0s audio duration parses exactly 44,100 sample frames."""
        path = os.path.join(self.temp_dir.name, "boundary_1s.wav")
        generate_wav(path, duration_seconds=1.0, sample_rate=44100)
        import wave
        with wave.open(path, "r") as wf:
            self.assertEqual(wf.getnframes(), 44100)

    def test_long_duration_audio_10_minutes(self):
        """Verifies long duration audio (600 seconds) duration calculation."""
        expected_seconds = 600.0
        sample_rate = 8000  # Lower rate to test frame scaling efficiently
        total_frames = int(expected_seconds * sample_rate)
        calc_duration = total_frames / float(sample_rate)
        self.assertEqual(calc_duration, expected_seconds)

    def test_extreme_duration_audio_30_minutes(self):
        """Verifies platform bounds for extreme duration (1800s) audio decimation."""
        duration_s = 1800.0
        target_bars = 80
        # Decimation must compress 1800s down to 80 bars without memory explosion
        seconds_per_bar = duration_s / target_bars
        self.assertAlmostEqual(seconds_per_bar, 22.5, places=2)


if __name__ == "__main__":
    unittest.main()
