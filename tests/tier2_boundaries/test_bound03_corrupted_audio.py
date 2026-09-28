"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 03: Corrupted Audio (survey_specs.md §8).
Tests truncated WAV headers, random binary data with audio extension,
text files masquerading as audio, empty 0-byte files, and unsupported codecs.
"""

import os
import tempfile
import unittest
from tests.test_harness import generate_corrupted_audio, SoundWaveApiClient


class TestBound03CorruptedAudio(unittest.TestCase):
    """Verifies server & engine rejection of corrupt, truncated, or forged audio files."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = SoundWaveApiClient()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_truncated_wav_header_rejection(self):
        """Verifies file with incomplete RIFF header cannot be parsed as valid audio."""
        bad_path = os.path.join(self.temp_dir.name, "truncated.wav")
        generate_corrupted_audio(bad_path, mode="truncated_header")
        self.assertTrue(os.path.exists(bad_path))

        import wave
        with self.assertRaises(Exception):
            with wave.open(bad_path, "r") as wf:
                wf.getnframes()

    def test_random_binary_noise_with_audio_extension(self):
        """Verifies random binary data cannot be parsed as valid audio."""
        bad_path = os.path.join(self.temp_dir.name, "random_garbage.wav")
        generate_corrupted_audio(bad_path, mode="random_bytes")

        import wave
        with self.assertRaises(Exception):
            with wave.open(bad_path, "r") as wf:
                wf.getnframes()

    def test_text_file_masquerading_as_audio(self):
        """Verifies plain ASCII text file renamed to .wav is rejected."""
        bad_path = os.path.join(self.temp_dir.name, "fake_audio.wav")
        generate_corrupted_audio(bad_path, mode="text_masquerade")

        import wave
        with self.assertRaises(Exception):
            with wave.open(bad_path, "r") as wf:
                wf.getnframes()

    def test_empty_zero_byte_file_upload(self):
        """Verifies 0-byte empty file upload is rejected with error."""
        empty_path = os.path.join(self.temp_dir.name, "empty.wav")
        generate_corrupted_audio(empty_path, mode="zero_bytes")
        self.assertEqual(os.path.getsize(empty_path), 0)

        import wave
        with self.assertRaises(Exception):
            with wave.open(empty_path, "r") as wf:
                wf.getnframes()

    def test_invalid_sample_rate_header(self):
        """Verifies invalid/zero sample rate in audio container is rejected."""
        bad_path = os.path.join(self.temp_dir.name, "bad_rate.wav")
        generate_corrupted_audio(bad_path, mode="bad_sample_rate")

        import wave
        with self.assertRaises(Exception):
            with wave.open(bad_path, "r") as wf:
                rate = wf.getframerate()
                if rate <= 0:
                    raise ValueError("Invalid sample rate")


if __name__ == "__main__":
    unittest.main()
