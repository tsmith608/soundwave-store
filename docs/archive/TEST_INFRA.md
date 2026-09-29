# E2E Test Infra: SoundWave Art Store Restructuring

## Test Philosophy
- Opaque-box, requirement-driven. Derives strictly from ORIGINAL_REQUEST.md.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Application Scenarios.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|---------------------|:-----------------:|:-----------------:|:---------------------:|:-----------------:|
| F1 | Multi-Page Routes (`/`, `/shop`, `/product/custom`) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F2 | Animation Library & Layout Structure | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F3 | Aesthetic Market Research Artifact (`research_findings.md`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F4 | Customizer Template Selection ($\ge 5$ templates) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F5 | Python Backend PDF Generation with Aesthetic Templates | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Frontend Test Suite**: `tests/test_e2e_frontend_store.ts` (run via `npx tsx`)
  - Validates route status and HTML/component tree for `/`, `/shop`, `/product/custom`.
  - Verifies `framer-motion` imports, motion component usage, and responsive luxury styling.
  - Verifies presence and completeness of `research_findings.md` with $\ge 5$ detailed themes.
  - Verifies interactive customizer template selector allows choosing $\ge 5$ distinct aesthetic templates.
- **Backend Test Suite**: `tests/test_e2e_pdf_generation.py` (run via `python -m unittest`)
  - Compiles high-resolution 300 DPI PDFs across all 8 aesthetic themes.
  - Asserts PDF file size $\ge 1,000,000$ bytes (strict fine-art noise guarantee).
  - Asserts physical inch MediaBox dimensions match specified frame size.
  - Tests soundwave-only and photo+soundwave variants for each theme.
  - Validates preview thumbnail generation ($< 500$ KB).
- **Master Test Runner**: `python tests/run_all_tests.py`
  - Runs all test tiers sequentially.
  - Emits summary report and exits with 0 only if 100% pass.

## Coverage Thresholds
- Tier 1: $\ge 5$ tests per feature.
- Tier 2: $\ge 5$ boundary/edge tests per feature (e.g. missing photo, zero audio, long captions, extreme sizes).
- Tier 3: Pairwise combinations of themes, frame sizes, and photo presence.
- Tier 4: Real-world user journeys (browsing homepage -> selecting catalog preset -> customizing -> checkout -> PDF fulfillment).
- Total Target: $> 50$ automated checks.
