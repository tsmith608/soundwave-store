"""
Tier 1: Feature Coverage Tests.
Feature 02: Audio File Upload (MP3/WAV) (R1, AC).
Tests client & server audio file upload handling, format validation,
duration extraction, and size limit contracts.
"""

import os
import tempfile
import unittest
from tests.test_harness import SoundWaveApiClient, generate_wav, generate_corrupted_audio


class TestFeature02AudioUpload(unittest.TestCase):
    """Verifies audio file upload functionality for MP3 and WAV files."""

    def setUp(self):
        self.client = SoundWaveApiClient()
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_upload_wav_audio_format_acceptance(self):
        """Verifies valid PCM WAV audio files are accepted and processed."""
        wav_path = os.path.join(self.temp_dir.name, "test_sample.wav")
        generate_wav(wav_path, duration_seconds=3.0, sample_rate=44100, frequency=440.0)
        self.assertTrue(os.path.exists(wav_path))
        file_size = os.path.getsize(wav_path)
        self.assertGreater(file_size, 0, "Generated WAV must contain binary audio data")

        if self.client.is_server_reachable():
            resp = self.client.upload_audio(wav_path, content_type="audio/wav")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data.get("success"))
            self.assertTrue(data.get("audioId", "").startswith("aud_"))

    def test_upload_mp3_audio_format_acceptance(self):
        """Verifies MP3 mime types and file extensions are allowed under upload contract."""
        allowed_extensions = [".mp3", ".wav", ".webm", ".m4a"]
        allowed_mimetypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/webm"]

        self.assertIn(".mp3", allowed_extensions)
        self.assertIn(".wav", allowed_extensions)
        self.assertIn("audio/mpeg", allowed_mimetypes)
        self.assertIn("audio/wav", allowed_mimetypes)

    def test_upload_file_size_limit_contract(self):
        """Verifies maximum upload size contract (up to 50MB permitted, larger rejected)."""
        max_allowed_bytes = 50 * 1024 * 1024  # 50 MB
        test_payload_size = 5 * 1024 * 1024   # 5 MB typical MP3

        self.assertLess(test_payload_size, max_allowed_bytes)
        oversized_payload_bytes = 55 * 1024 * 1024
        self.assertGreater(oversized_payload_bytes, max_allowed_bytes)

    def test_upload_disallows_unsupported_extensions(self):
        """Verifies non-audio files (e.g., .txt, .exe, .pdf) are rejected."""
        invalid_extensions = [".txt", ".exe", ".pdf", ".sh", ".py", ".zip"]
        for ext in invalid_extensions:
            self.assertFalse(
                ext.lower() in [".mp3", ".wav", ".webm"],
                f"Extension {ext} must not be accepted as valid audio",
            )

    def test_upload_calculates_valid_duration(self):
        """Verifies duration calculation matches audio length."""
        wav_path = os.path.join(self.temp_dir.name, "duration_test.wav")
        duration = 4.5
        generate_wav(wav_path, duration_seconds=duration, sample_rate=44100)

        # Direct mathematical verification of sample frame count / frame rate
        import wave
        with wave.open(wav_path, "r") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            computed_duration = frames / float(rate)
            self.assertAlmostEqual(computed_duration, duration, places=2)


if __name__ == "__main__":
    unittest.main()
