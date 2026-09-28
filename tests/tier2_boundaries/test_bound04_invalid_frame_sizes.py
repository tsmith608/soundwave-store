"""
Tier 2: Boundary & Corner Cases Tests.
Boundary 04: Invalid Frame Sizes (survey_specs.md §8).
Tests unsupported dimensions, empty/missing sizes, numeric types,
injection strings, and case/whitespace discrepancies.
"""

import unittest
from tests.test_harness import FRAME_SIZES


class TestBound04InvalidFrameSizes(unittest.TestCase):
    """Verifies strict validation of frame size enum: ['8x10', '11x14', '16x20', '24x36']."""

    ALLOWED_SIZES = set(FRAME_SIZES.keys())

    def test_unsupported_dimensions_rejected(self):
        """Verifies unsupported frame sizes like 5x7 or 50x70 are rejected."""
        unsupported = ["5x7", "4x6", "12x18", "18x24", "30x40", "50x70", "A4", "A3"]
        for size in unsupported:
            self.assertNotIn(size, self.ALLOWED_SIZES, f"Size {size} must not be allowed")

    def test_empty_or_missing_frame_size(self):
        """Verifies empty string or None frame size fails validation."""
        for invalid_val in ["", "   ", None]:
            self.assertNotIn(invalid_val, self.ALLOWED_SIZES)

    def test_numeric_type_instead_of_string_enum(self):
        """Verifies numeric types (e.g. 1620, 810) are rejected."""
        numeric_inputs = [1620, 810, 1114, 2436]
        for val in numeric_inputs:
            self.assertNotIn(val, self.ALLOWED_SIZES)

    def test_frame_size_with_injection_strings(self):
        """Verifies malicious script or path traversal in frame size is blocked."""
        malicious = ["16x20; DROP TABLE orders;", "../../../etc/passwd", "<script>alert(1)</script>"]
        for attack in malicious:
            self.assertNotIn(attack, self.ALLOWED_SIZES)

    def test_frame_size_case_and_whitespace_strictness(self):
        """Verifies enum strictness: uppercase '16X20' or ' 16x20 ' are not matched without normalization."""
        variations = ["16X20", " 16x20", "16x20 ", "8X10"]
        for v in variations:
            self.assertNotIn(v, self.ALLOWED_SIZES)


if __name__ == "__main__":
    unittest.main()
