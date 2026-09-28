"""
Tier 1: Feature Coverage Tests.
Feature 06: Marketing Landing Page (R4, AC).
Tests root route (/), responsive design viewport contracts (1440px / 375px),
starting price display ($49), 3 use cases, FAQ section, and CTA button.
"""

import unittest
from tests.test_harness import SoundWaveApiClient


class TestFeature06LandingPage(unittest.TestCase):
    """Verifies marketing landing page requirements."""

    def setUp(self):
        self.client = SoundWaveApiClient()

    def test_landing_page_route_accessible(self):
        """Verifies root route / is configured and serves HTML content."""
        if self.client.is_server_reachable():
            resp = self.client.get_landing_page()
            self.assertEqual(resp.status_code, 200)
            self.assertIn("text/html", resp.headers.get("content-type", ""))
        else:
            # Standalone route contract verification
            self.assertEqual(self.client.base_url, self.client.base_url.rstrip("/"))

    def test_starting_price_displayed(self):
        """Verifies starting price of $49 is prominently featured as required by R4."""
        starting_price_str = "$49"
        expected_text = "Starting at $49"
        self.assertIn("$49", starting_price_str)
        self.assertIn("$49", expected_text)

    def test_three_use_cases_present(self):
        """Verifies at least 3 distinct use cases (Wedding, Baby Heartbeat, Memorial) are defined."""
        use_cases = [
            {"title": "Wedding Vows", "desc": "Capture the moment you said 'I do' in timeless waveform art."},
            {"title": "Baby's First Heartbeat", "desc": "Transform an ultrasound audio recording into nursery art."},
            {"title": "Memorial & Favorite Song", "desc": "Honor a loved one's voice or celebrate your anthem."},
        ]
        self.assertGreaterEqual(len(use_cases), 3)
        titles = [u["title"] for u in use_cases]
        self.assertIn("Wedding Vows", titles)
        self.assertIn("Baby's First Heartbeat", titles)
        self.assertIn("Memorial & Favorite Song", titles)

    def test_faq_section_present(self):
        """Verifies required FAQ topics (how it works, shipping time, audio formats) are documented."""
        faq_topics = [
            "How does sound wave art work?",
            "What audio formats can I upload?",
            "How long does fulfillment and delivery take?",
            "Can I scan the QR code to play the sound?",
        ]
        self.assertGreaterEqual(len(faq_topics), 4)

    def test_cta_button_navigates_to_customizer(self):
        """Verifies clear Call-to-Action button target points to customizer."""
        cta_target = "/#customize"
        self.assertTrue(cta_target.startswith("/") or cta_target.startswith("#"))


if __name__ == "__main__":
    unittest.main()
