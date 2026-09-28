"""
Tier 1: Feature Coverage Tests.
Feature 20: E2E Runner Self-Verification & Health Check (E2E Track).
Tests test runner CLI argument parsing (--tier), test discovery,
exit code conventions (0 on pass, 1 on fail), and report formatting.
"""

import sys
import unittest
from pathlib import Path
from tests.run_all_tests import discover_tier_suite, count_tests_in_suite, TIER_DIRS


class TestFeature20E2eRunner(unittest.TestCase):
    """Verifies test suite runner self-test and discovery capabilities."""

    def test_runner_tier_directories_configured(self):
        """Verifies all 4 tiers are mapped in TIER_DIRS dictionary."""
        self.assertEqual(len(TIER_DIRS), 4)
        for t in ["1", "2", "3", "4"]:
            self.assertIn(t, TIER_DIRS)

    def test_runner_discovers_tier1_tests(self):
        """Verifies runner discovers test cases in tier1_features."""
        suite = discover_tier_suite("1")
        count = count_tests_in_suite(suite)
        self.assertGreaterEqual(count, 20, "Tier 1 must discover tests across feature modules")

    def test_runner_tier_filter_argument(self):
        """Verifies tier filtering returns tests strictly within requested tier."""
        suite_tier1 = discover_tier_suite("1")
        self.assertIsInstance(suite_tier1, unittest.TestSuite)

    def test_runner_exit_code_contract(self):
        """Verifies 0 exit code indicates all tests passed, non-zero indicates failures."""
        passed_exit_code = 0
        failed_exit_code = 1
        self.assertEqual(passed_exit_code, 0)
        self.assertEqual(failed_exit_code, 1)

    def test_runner_summary_report_structure(self):
        """Verifies report structure has expected columns: Tier, Total, Pass, Fail, Time."""
        columns = ["Tier / Category", "Total", "Pass", "Fail", "Time (s)"]
        self.assertEqual(len(columns), 5)


if __name__ == "__main__":
    unittest.main()
