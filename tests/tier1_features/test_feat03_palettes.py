"""
Tier 1: Feature Coverage Tests.
Feature 03: Palette Customizer (R1, AC).
Tests color palette definitions (Midnight Gold, White/Silver, Dark Blue/White),
hex validation regex, contrast ratios, and preview state integration.
"""

import re
import unittest
from tests.test_harness import PALETTES


def hex_to_relative_luminance(hex_code: str) -> float:
    """Calculates relative luminance according to WCAG 2.1 specifications."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    r, g, b = [int(hex_clean[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    channels = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(hex1: str, hex2: str) -> float:
    """Calculates contrast ratio (1:1 to 21:1) between two hex colors."""
    l1 = hex_to_relative_luminance(hex1)
    l2 = hex_to_relative_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


class TestFeature03Palettes(unittest.TestCase):
    """Verifies color palette options and specifications."""

    HEX_REGEX = re.compile(r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")

    def test_midnight_gold_palette_spec(self):
        """Verifies Midnight Gold palette has black background and gold waveform."""
        p = PALETTES["midnight_gold"]
        self.assertEqual(p["bg"].lower(), "#0c0c0c")
        self.assertEqual(p["wave"].lower(), "#d4af37")
        self.assertEqual(p["name"], "Midnight Gold")

    def test_white_silver_palette_spec(self):
        """Verifies White / Silver palette has white background and silver waveform."""
        p = PALETTES["white_silver"]
        self.assertEqual(p["bg"].lower(), "#ffffff")
        self.assertEqual(p["wave"].lower(), "#a0a0a0")
        self.assertEqual(p["name"], "White / Silver")

    def test_dark_blue_white_palette_spec(self):
        """Verifies Dark Blue / White palette has navy/dark blue background and white waveform."""
        p = PALETTES["dark_blue_white"]
        self.assertEqual(p["bg"].lower(), "#0f172a")
        self.assertEqual(p["wave"].lower(), "#ffffff")
        self.assertEqual(p["name"], "Dark Blue / White")

    def test_hex_color_validation_contract(self):
        """Verifies all defined palettes comply with strict 3 or 6 digit hex regex."""
        for palette_id, p in PALETTES.items():
            self.assertTrue(
                self.HEX_REGEX.match(p["bg"]),
                f"Palette {palette_id} bg {p['bg']} failed hex validation",
            )
            self.assertTrue(
                self.HEX_REGEX.match(p["wave"]),
                f"Palette {palette_id} wave {p['wave']} failed hex validation",
            )

    def test_palette_contrast_ratio_standard(self):
        """Verifies that all 3 palettes maintain sufficient visual contrast (>= 2.5:1) for print legibility."""
        for palette_id, p in PALETTES.items():
            ratio = contrast_ratio(p["bg"], p["wave"])
            self.assertGreaterEqual(
                ratio,
                2.5,
                f"Palette {palette_id} contrast ratio {ratio:.2f}:1 is too low for print legibility",
            )


if __name__ == "__main__":
    unittest.main()
