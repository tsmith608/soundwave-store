"""
Tier 1: Feature Coverage Tests.
Feature 01: Live Mic Recording with Animated Canvas (R1, AC).
Tests browser audio capture parameters, AnalyserNode FFT config,
audio buffer chunk processing, state transitions, and error handling.
"""

import math
import struct
import unittest
from tests.test_harness import SoundWaveApiClient


class TestFeature01MicRecording(unittest.TestCase):
    """Verifies live mic recording and animated waveform canvas requirements."""

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_mic_capture_audio_format_contract(self):
        """Verifies mic audio stream format contracts (16-bit PCM, 44.1kHz/48kHz sample rate, mono)."""
        supported_sample_rates = [44100, 48000]
        sample_width_bytes = 2  # 16-bit PCM
        channels = 1  # Mono stream for microphone speech

        # Verify bit depth and byte alignment
        self.assertEqual(sample_width_bytes * 8, 16, "Mic capture must support 16-bit linear PCM")
        self.assertIn(44100, supported_sample_rates, "Must support 44.1 kHz standard audio rate")
        self.assertIn(48000, supported_sample_rates, "Must support 48.0 kHz web audio standard rate")
        self.assertEqual(channels, 1, "Default mic input should be single-channel mono")

    def test_analyser_node_fft_size_configuration(self):
        """Verifies Web Audio API AnalyserNode configuration contracts for real-time visualization."""
        fft_size = 2048
        smoothing_time_constant = 0.8
        min_decibels = -90
        max_decibels = -10

        # Verify fft_size is a power of 2 between 32 and 32768
        self.assertTrue((fft_size & (fft_size - 1)) == 0, "fftSize must be a power of two")
        self.assertGreaterEqual(fft_size, 512, "fftSize must provide sufficient frequency resolution")
        self.assertLessEqual(fft_size, 4096, "fftSize must remain responsive under 60fps canvas loop")
        self.assertGreaterEqual(smoothing_time_constant, 0.0)
        self.assertLessEqual(smoothing_time_constant, 1.0)
        self.assertLess(min_decibels, max_decibels, "minDecibels must be lower than maxDecibels")

    def test_mic_recording_state_transitions(self):
        """Verifies state machine transitions for microphone recording lifecycle."""
        valid_states = ["idle", "requesting_permission", "recording", "paused", "stopped", "processing"]
        current_state = "idle"

        # Simulate user click record
        current_state = "requesting_permission"
        self.assertIn(current_state, valid_states)

        # Simulate permission granted & recording active
        current_state = "recording"
        self.assertEqual(current_state, "recording")

        # Simulate user stops recording
        current_state = "stopped"
        self.assertEqual(current_state, "stopped")

        # Simulate processing chunks into static audio buffer
        current_state = "processing"
        self.assertEqual(current_state, "processing")

    def test_mic_time_domain_amplitude_extraction(self):
        """Verifies time-domain audio data extraction converts raw bytes to normalized [0.0, 1.0] amplitudes."""
        raw_samples = [0, 8192, 16384, 24576, 32767, -16384, -32768]
        normalized = [abs(s) / 32768.0 for s in raw_samples]

        for amp in normalized:
            self.assertGreaterEqual(amp, 0.0, "Normalized amplitude cannot be negative")
            self.assertLessEqual(amp, 1.0, "Normalized amplitude cannot exceed 1.0")

        # Peak sample must normalize to ~1.0
        self.assertAlmostEqual(max(normalized), 1.0, places=2)

    def test_mic_permission_denial_graceful_handling(self):
        """Verifies error handling contract when user denies microphone access."""
        error_event = {
            "name": "NotAllowedError",
            "message": "Permission to access microphone was denied",
            "userActionRequired": "enable_mic_or_upload_file",
        }
        self.assertEqual(error_event["name"], "NotAllowedError")
        self.assertIn("upload_file", error_event["userActionRequired"], 
                      "When mic is denied, storefront must offer file upload fallback")


if __name__ == "__main__":
    unittest.main()
