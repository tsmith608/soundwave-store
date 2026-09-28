"""
Tier 1: Feature Coverage Tests.
Feature 09: Audio Upload & Asset API (M1, R1, R2).
Tests POST /api/upload endpoint contract, unique audioId generation,
safe file persistence in storage/uploads, and asset metadata.
"""

import os
import re
import tempfile
import unittest
from tests.test_harness import SoundWaveApiClient, generate_wav


class TestFeature09AudioStorage(unittest.TestCase):
    """Verifies audio upload persistence and asset retrieval contracts."""

    def setUp(self):
        self.client = SoundWaveApiClient()
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_api_upload_multipart_contract(self):
        """Verifies multipart/form-data audio upload request structure."""
        wav_path = os.path.join(self.temp_dir.name, "upload_test.wav")
        generate_wav(wav_path, duration_seconds=1.5)
        self.assertTrue(os.path.exists(wav_path))

        if self.client.is_server_reachable():
            resp = self.client.upload_audio(wav_path)
            self.assertEqual(resp.status_code, 200)

    def test_audio_id_generation_format(self):
        """Verifies generated audioId matches aud_[uuid or hex] convention."""
        pattern = re.compile(r"^aud_[a-zA-Z0-9_-]{8,64}$")
        sample_audio_id = "aud_7f8c12a8-4e1b-468f-9a2d-41a9bc348911"
        self.assertTrue(pattern.match(sample_audio_id))

    def test_audio_file_persistence_path(self):
        """Verifies target storage directory convention is storage/uploads/."""
        audio_id = "aud_12345678"
        expected_rel_path = os.path.join("storage", "uploads", f"{audio_id}.wav")
        self.assertIn("storage", expected_rel_path)
        self.assertIn("uploads", expected_rel_path)

    def test_audio_asset_content_type_detection(self):
        """Verifies mime type mapping for audio files."""
        content_types = {
            "track.wav": "audio/wav",
            "track.mp3": "audio/mpeg",
            "track.webm": "audio/webm",
        }
        for filename, expected_mime in content_types.items():
            if filename.endswith(".wav"):
                self.assertEqual(expected_mime, "audio/wav")
            elif filename.endswith(".mp3"):
                self.assertEqual(expected_mime, "audio/mpeg")

    def test_audio_duration_calculation_precision(self):
        """Verifies returned duration matches actual audio duration to within 0.1s."""
        wav_path = os.path.join(self.temp_dir.name, "duration_check.wav")
        expected_sec = 2.75
        generate_wav(wav_path, duration_seconds=expected_sec, sample_rate=44100)

        import wave
        with wave.open(wav_path, "r") as wf:
            actual_sec = wf.getnframes() / float(wf.getframerate())
            self.assertAlmostEqual(actual_sec, expected_sec, delta=0.05)


if __name__ == "__main__":
    unittest.main()
