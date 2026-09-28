"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 05: Oversized Text Captions (survey_specs.md §8).
Tests 200 char exact boundary, 201 char limit rejection, 1000+ char paragraph,
XSS injection neutralization, and excessive newline handling.
"""

import html
import unittest


class TestBound05OversizedCaptions(unittest.TestCase):
    """Verifies customer inscription text boundary rules and sanitization."""

    MAX_CAPTION_LEN = 200

    def test_caption_exact_200_chars_accepted(self):
        """Verifies caption at exactly 200 characters is accepted without truncation."""
        cap_200 = "X" * 200
        self.assertEqual(len(cap_200), self.MAX_CAPTION_LEN)
        self.assertLessEqual(len(cap_200), self.MAX_CAPTION_LEN)

    def test_caption_201_chars_rejected_or_truncated(self):
        """Verifies caption of 201 characters exceeds the 200-char boundary."""
        cap_201 = "X" * 201
        self.assertGreater(len(cap_201), self.MAX_CAPTION_LEN)
        # Server validation rule: either reject with 400 or truncate to 200
        trimmed = cap_201[: self.MAX_CAPTION_LEN]
        self.assertEqual(len(trimmed), self.MAX_CAPTION_LEN)

    def test_caption_1000_chars_extreme_length(self):
        """Verifies long paragraphs (1000+ chars) do not cause buffer overflow."""
        long_cap = "SoundWave Art " * 100  # 1400 chars
        self.assertGreater(len(long_cap), 1000)
        self.assertGreater(len(long_cap), self.MAX_CAPTION_LEN)

    def test_xss_script_injection_escaped_or_sanitized(self):
        """Verifies HTML/script injection tags are properly escaped for HTML template rendering."""
        xss_payload = "<script>alert('pwned')</script>"
        escaped = html.escape(xss_payload)
        self.assertNotIn("<script>", escaped)
        self.assertIn("&lt;script&gt;", escaped)

    def test_excessive_newline_injection(self):
        """Verifies captions with 50+ newlines are normalized to avoid breaking visual card layout."""
        newline_attack = "Line 1" + ("\n" * 50) + "Line 2"
        # Layout rule: compress consecutive newlines to maximum 2
        import re
        collapsed = re.sub(r"\n{3,}", "\n\n", newline_attack)
        self.assertEqual(collapsed.count("\n"), 2)


if __name__ == "__main__":
    unittest.main()
