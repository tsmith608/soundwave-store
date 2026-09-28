#!/usr/bin/env python3
"""
SoundWave Art — Master 4-Tier E2E Test Suite Runner.
Executes both TypeScript frontend store tests and Python PDF fulfillment tests across all 4 tiers:
  Tier 1: Core Feature Coverage (Frontend routes, motion primitives, market research, customizer templates, PDF generation)
  Tier 2: Boundary & Corner Cases (Query params, fallback themes, extreme captions, extreme photo ratios)
  Tier 3: Cross-Feature Combinations (Navbar/footer navigation, catalog preset deep-linking, QR embedding, theme matrix)
  Tier 4: Real-World Scenarios & Workflows (Customer discovery journey, end-to-end fulfillment pipeline, asset consistency)

Usage:
  python tests/run_all_tests.py
  python tests/run_all_tests.py --frontend
  python tests/run_all_tests.py --backend
  python tests/run_all_tests.py --tier 1
  python tests/run_all_tests.py --legacy
  python tests/run_all_tests.py -v
"""

from __future__ import annotations

import argparse
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import unittest
from typing import Any, Dict, List, Optional, Tuple

TESTS_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_ROOT.parent

# Ensure project root in sys.path
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def get_npx_executable() -> str:
    """Resolves npx executable safely across Windows and Unix."""
    if sys.platform == "win32":
        return shutil.which("npx.cmd") or shutil.which("npx") or "npx.cmd"
    return shutil.which("npx") or "npx"


def run_frontend_e2e(verbose: bool = False) -> Dict[str, Any]:
    """Executes TypeScript frontend E2E test suite via tsx."""
    npx_cmd = get_npx_executable()
    script_path = TESTS_ROOT / "test_e2e_frontend_store.ts"

    start_time = time.time()
    try:
        proc = subprocess.run(
            [npx_cmd, "tsx", str(script_path), "--json"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception as e:
        return {
            "success": False,
            "duration": time.time() - start_time,
            "stdout": "",
            "stderr": str(e),
            "tiers": {},
            "total": 0,
            "passed": 0,
            "failed": 1,
            "error": f"Failed to execute npx tsx: {e}",
        }

    duration = time.time() - start_time
    stdout = proc.stdout
    stderr = proc.stderr

    # Parse JSON block from output if available
    tier_data: Dict[str, Any] = {}
    parsed_json = None
    for line in stdout.splitlines():
        line_clean = line.strip()
        if line_clean.startswith('{"suite":"frontend_e2e"'):
            try:
                parsed_json = json.loads(line_clean)
                tier_data = parsed_json.get("tiers", {})
            except Exception:
                pass

    total = parsed_json.get("total", 0) if parsed_json else 0
    passed = parsed_json.get("passed", 0) if parsed_json else 0
    failed = parsed_json.get("failed", 0) if parsed_json else (1 if proc.returncode != 0 else 0)

    return {
        "success": proc.returncode == 0,
        "returncode": proc.returncode,
        "duration": duration,
        "stdout": stdout,
        "stderr": stderr,
        "tiers": tier_data,
        "total": total,
        "passed": passed,
        "failed": failed,
    }


def run_backend_pdf_tier(test_classes: List[type], tier_name: str, verbose: bool = False) -> Dict[str, Any]:
    """Executes Python PDF generation test classes for a specific tier."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for cls in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    stream = io.StringIO()
    runner = unittest.TextTestRunner(
        stream=stream,
        verbosity=2 if verbose else 1,
    )

    start_time = time.time()
    result = runner.run(suite)
    duration = time.time() - start_time

    total = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    passed = total - failures - errors

    failure_details = []
    for test_case, trace in result.failures + result.errors:
        failure_details.append((str(test_case), trace))

    return {
        "tier_name": tier_name,
        "total": total,
        "passed": passed,
        "failed": failures + errors,
        "duration": duration,
        "failure_details": failure_details,
        "output": stream.getvalue(),
    }


def run_all_tiers(
    run_frontend: bool = True,
    run_backend: bool = True,
    filter_tier: Optional[str] = None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Executes full 4-tier suite combining frontend and backend tests."""
    tier_results = {
        "Tier 1": {"total": 0, "passed": 0, "failed": 0, "duration": 0.0, "details": []},
        "Tier 2": {"total": 0, "passed": 0, "failed": 0, "duration": 0.0, "details": []},
        "Tier 3": {"total": 0, "passed": 0, "failed": 0, "duration": 0.0, "details": []},
        "Tier 4": {"total": 0, "passed": 0, "failed": 0, "duration": 0.0, "details": []},
    }

    # 1. Run Frontend Suite
    if run_frontend:
        print("[1/2] Executing Frontend Store E2E Tests (TypeScript / tsx)...")
        fe_res = run_frontend_e2e(verbose=verbose)
        if verbose:
            print(fe_res["stdout"])
            if fe_res["stderr"]:
                print(fe_res["stderr"], file=sys.stderr)

        # Distribute frontend tiers
        fe_tiers = fe_res.get("tiers", {})
        for t_key in ["Tier 1", "Tier 2", "Tier 3", "Tier 4"]:
            if t_key in fe_tiers:
                tier_results[t_key]["total"] += fe_tiers[t_key].get("total", 0)
                tier_results[t_key]["passed"] += fe_tiers[t_key].get("passed", 0)
                tier_results[t_key]["failed"] += fe_tiers[t_key].get("failed", 0)
                tier_results[t_key]["duration"] += fe_res["duration"] / 4.0

        if not fe_res["success"] and fe_res.get("error"):
            tier_results["Tier 1"]["failed"] += 1
            tier_results["Tier 1"]["details"].append(("Frontend Execution Error", fe_res["error"]))

    # 2. Run Backend PDF Generation Suite
    if run_backend:
        print("[2/2] Executing Backend PDF Fulfillment E2E Tests (Python / Playwright)...")
        try:
            from tests.test_e2e_pdf_generation import (
                TestTier1FeatureCoverage,
                TestTier2BoundaryCases,
                TestTier3Combinations,
                TestTier4Workloads,
            )

            tier_map = [
                ("Tier 1", [TestTier1FeatureCoverage]),
                ("Tier 2", [TestTier2BoundaryCases]),
                ("Tier 3", [TestTier3Combinations]),
                ("Tier 4", [TestTier4Workloads]),
            ]

            for t_key, test_classes in tier_map:
                if filter_tier and filter_tier != t_key.split()[1]:
                    continue
                print(f"      Running {t_key} Backend Tests...")
                b_res = run_backend_pdf_tier(test_classes, t_key, verbose=verbose)
                tier_results[t_key]["total"] += b_res["total"]
                tier_results[t_key]["passed"] += b_res["passed"]
                tier_results[t_key]["failed"] += b_res["failed"]
                tier_results[t_key]["duration"] += b_res["duration"]
                tier_results[t_key]["details"].extend(b_res["failure_details"])
        except Exception as e:
            print(f"Error loading backend PDF tests: {e}", file=sys.stderr)
            tier_results["Tier 1"]["failed"] += 1
            tier_results["Tier 1"]["details"].append(("Backend Import Error", str(e)))

    return tier_results


def print_summary_table(tier_results: Dict[str, Any]):
    """Renders formatted ASCII summary table for test results."""
    tier_titles = {
        "Tier 1": "Tier 1: Core Feature Coverage",
        "Tier 2": "Tier 2: Boundary & Corner Cases",
        "Tier 3": "Tier 3: Cross-Feature Combinations",
        "Tier 4": "Tier 4: Real-World Scenarios",
    }

    print("\n" + "=" * 80)
    print("           SOUNDWAVE ART — UNIFIED 4-TIER E2E TEST REPORT")
    print("=" * 80)
    print(f"{'Tier / Category':<40} | {'Total':<6} | {'Pass':<6} | {'Fail':<6} | {'Time (s)':<8}")
    print("-" * 80)

    grand_total = 0
    grand_passed = 0
    grand_failed = 0
    grand_duration = 0.0

    for t_key in ["Tier 1", "Tier 2", "Tier 3", "Tier 4"]:
        data = tier_results[t_key]
        t_title = tier_titles.get(t_key, t_key)
        tot = data["total"]
        pas = data["passed"]
        fai = data["failed"]
        dur = data["duration"]

        grand_total += tot
        grand_passed += pas
        grand_failed += fai
        grand_duration += dur

        status = "[OK]" if fai == 0 and tot > 0 else ("[FAIL]" if fai > 0 else "[EMPTY]")
        print(f"{status} {t_title:<35} | {tot:<6} | {pas:<6} | {fai:<6} | {dur:<8.2f}s")

    print("-" * 80)
    overall_status = "[100% PASS]" if grand_failed == 0 and grand_total > 0 else "[FAILED]"
    print(f"{overall_status} {'OVERALL TOTALS':<33} | {grand_total:<6} | {grand_passed:<6} | {grand_failed:<6} | {grand_duration:<8.2f}s")
    print("=" * 80 + "\n")

    if grand_failed > 0:
        print("!" * 80)
        print("                       FAILURE & ERROR DETAILS")
        print("!" * 80)
        for t_key, data in tier_results.items():
            if data["details"]:
                print(f"\n--- {tier_titles.get(t_key, t_key)} ---")
                for test_name, trace in data["details"]:
                    print(f"\n[FAIL] {test_name}")
                    print(trace.strip())
        print("\n" + "!" * 80 + "\n")


def run_legacy_suite(verbose: bool = False):
    """Optionally executes legacy tier directories if requested."""
    print("\n--- Running Legacy Discovery Suite ---")
    legacy_dirs = ["tier1_features", "tier2_boundaries", "tier3_combinations", "tier4_workloads"]
    for d in legacy_dirs:
        folder = TESTS_ROOT / d
        if folder.exists():
            print(f"Discovering in {d}...")
            suite = unittest.defaultTestLoader.discover(str(folder), pattern="test_*.py")
            runner = unittest.TextTestRunner(verbosity=2 if verbose else 1)
            runner.run(suite)


def main():
    parser = argparse.ArgumentParser(description="SoundWave Art Unified 4-Tier E2E Test Suite Runner")
    parser.add_argument("--frontend", action="store_true", help="Run only frontend store E2E tests")
    parser.add_argument("--backend", action="store_true", help="Run only backend PDF generation tests")
    parser.add_argument("--tier", choices=["1", "2", "3", "4"], help="Filter execution to a specific tier")
    parser.add_argument("--legacy", action="store_true", help="Also execute legacy tier directory suites")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose test execution output")
    args = parser.parse_args()

    run_fe = not args.backend
    run_be = not args.frontend

    results = run_all_tiers(
        run_frontend=run_fe,
        run_backend=run_be,
        filter_tier=args.tier,
        verbose=args.verbose,
    )

    print_summary_table(results)

    if args.legacy:
        run_legacy_suite(verbose=args.verbose)

    total_failed = sum(d["failed"] for d in results.values())
    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    main()
