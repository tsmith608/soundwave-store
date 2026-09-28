# Project: SoundWave Art Store Restructuring

## Architecture
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Framer Motion for Awwwards-level luxury transitions, Lucide icons.
  - Multi-page routing:
    - `/`: Editorial luxury homepage (storytelling, craftsmanship narrative, curated collections, theme spotlights).
    - `/shop`: Wall art catalog with category filters, frame size comparisons, interactive preset cards linking to customizer.
    - `/product/custom`: Dedicated bespoke customizer studio hosting `PortraitBuilder` with deep-linking query param support (`?template=...`).
    - `/order/[id]`: Luxury order status and tracking.
- **Customizer**: `PortraitBuilder.tsx` + `WaveformCanvas.tsx` supporting 8 distinct aesthetic templates, live microphone recording, audio file upload, photo placement with `object-fit: cover`, soundwave customization, and real-time 60 FPS HTML5 canvas preview.
- **Data Layer**: SQLite with Prisma ORM. `Order` model extended with `decorativeTheme String @default("botanical")`.
- **Backend Fulfillment**: Python 3.12+, Playwright headless Chromium for 300 DPI high-res PDF generation (`backend/print_engine.py`) using physical inch CSS page sizing and `backend/templates/poster_template.html`. Fine-art paper tooth noise synthesis (NumPy + Pillow) guaranteeing $\ge 1$MB PDF file size. Fast preview generation in `backend/preview_generator.py`.
- **E2E Testing Track**: Comprehensive dual-track test harness verifying multi-page routes, animation library presence, customizer UI selection ($\ge 5$ templates), `research_findings.md`, and high-res PDF generation with physical point and size validation.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Aesthetic Market Research | Conduct trending wall art & interior design aesthetic research, define 8 production-ready themes in `research_findings.md` | M1 | ORIGINAL_REQUEST §R2 |
| F2 | Database Contract Closure | Add `decorativeTheme` to `prisma/schema.prisma` and persist in `/api/checkout` | M2 | Survey 1 & 2 |
| F3 | Backend PDF Theme Rendering | Support all 8 aesthetic themes in `poster_template.html` and decouple borders from `photo_uri` | M2 | ORIGINAL_REQUEST §R3 |
| F4 | Backend Preview Generator | Update `preview_generator.py` for all 8 aesthetic themes | M2 | Survey 2 |
| F5 | Animation Libraries Installation | Install `framer-motion` and `lucide-react` in `package.json` | M3 | ORIGINAL_REQUEST §R1 |
| F6 | Motion Primitives | Implement reusable luxury motion primitives (`FadeIn`, `MagneticFrame`, `StaggerContainer`) | M3 | ORIGINAL_REQUEST §R1 |
| F7 | Editorial Luxury Homepage | Convert `/` into an Awwwards-level editorial homepage | M3 | ORIGINAL_REQUEST §R1 |
| F8 | Wall Art Catalog Route | Implement `/shop` route with filters and interactive cards | M3 | ORIGINAL_REQUEST §R1 |
| F9 | Dedicated Customizer Route | Implement `/product/custom` route with deep-linking query parameters | M3 | ORIGINAL_REQUEST §R1 |
| F10 | Global Navigation & Footer | Update `Navbar.tsx` and `Footer.tsx` with Next.js `<Link>` components to multi-page routes | M3 | ORIGINAL_REQUEST §R1 |
| F11 | Constants Expansion | Expand `DECORATIVE_STYLES` in `src/lib/constants.ts` to 8 themes ($\ge 5$) | M4 | ORIGINAL_REQUEST §R3 |
| F12 | Canvas Theme Rendering | Implement 2D canvas drawing routines for all 8 themes in `WaveformCanvas.tsx` | M4 | ORIGINAL_REQUEST §R3 |
| F13 | Customizer UI Template Selection | Enhance Step 2 of `PortraitBuilder.tsx` with visual aesthetic template cards | M4 | ORIGINAL_REQUEST §R3 |
| F14 | E2E Test Suite Infrastructure | Create opaque-box E2E test suite across Tiers 1-4 publishing `TEST_READY.md` | M5 | ORIGINAL_REQUEST §Acceptance Criteria |
| F15 | End-to-End Test Pass & Hardening | Verify 100% pass of E2E test suite, run Challenger stress tests, and Forensic Audit | M6 | Project Pattern Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Aesthetic Market Research | Produce `research_findings.md` documenting 8 trending visual themes | none | DONE |
| M2 | Backend PDF Fulfillment & DB Contract | `prisma/schema.prisma`, `/api/checkout`, `poster_template.html`, `preview_generator.py` | M1 | DONE |
| M3 | Frontend Multi-Page Store & Animations | Install `framer-motion`, motion primitives, `/`, `/shop`, `/product/custom`, `Navbar`, `Footer` | none | DONE |
| M4 | Customizer UI Aesthetic Templates | `src/lib/constants.ts`, `WaveformCanvas.tsx`, `PortraitBuilder.tsx` | M1, M2, M3 | DONE |
| M5 | Dual-Track E2E Test Suite | Automated test runner, route tests, animation checks, template selector checks, PDF generation tests | none | DONE |
| M6 | Final Verification & Forensic Audit | Pass 100% E2E tests, Reviewer approval, Challenger verification, Forensic Audit | M1, M2, M3, M4, M5 | DONE |

## Interface Contracts
### Frontend Customizer ↔ API Checkout
- Payload parameter: `decorativeStyle: string` (e.g. `"botanical"`, `"modern_border"`, `"arch"`, `"art_deco"`, `"celestial"`, `"luxury_marble"`, `"vintage_grunge"`, `"abstract_geometric"`).
- API `/api/checkout`: accepts `decorativeStyle` and stores as `decorativeTheme` in SQLite `Order` table.

### API Checkout ↔ Python Fulfillment Backend
- Database column: `Order.decorativeTheme` (String, default: `"botanical"`).
- Backend CLI / API input: `d["decorative_theme"]` or `d["decorativeTheme"]` or `--theme <name>`.
- Allowed theme keys:
  1. `botanical` (Minimalist Botanical)
  2. `modern_border` (Bauhaus Modern)
  3. `arch` (Architectural Arch)
  4. `art_deco` (Art Deco Noir)
  5. `vintage_grunge` (Vintage Grunge)
  6. `luxury_marble` (Luxury Marble)
  7. `abstract_geometric` (Abstract Geometric)
  8. `celestial` (Celestial Starlight)

### Python Fulfillment Engine Output
- Function: `compile_print_pdf(...)` in `backend/print_engine.py`.
- Format: High-res PDF at 300 DPI, exact MediaBox physical inch dimensions, file size $\ge 1,000,000$ bytes, scannable QR code.
- Thumbnail preview: `backend/preview_generator.py`, output JPEG $< 500$ KB.

## Code Layout
```
soundwave-store/
├── backend/
│   ├── assets/
│   │   ├── fonts/
│   │   └── textures/
│   ├── templates/
│   │   └── poster_template.html     # HTML/CSS/SVG high-res print template
│   ├── fulfill.py                   # Order fulfillment orchestration
│   ├── print_engine.py              # Playwright Chromium 300 DPI PDF compiler
│   ├── preview_generator.py         # Pillow preview thumbnail generator
│   └── waveform_generator.py        # Audio waveform extraction & rendering
├── prisma/
│   ├── schema.prisma                # SQLite schema with Order model
│   └── dev.db
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── checkout/route.ts    # Checkout session creation & order persistence
│   │   │   ├── orders/[id]/...
│   │   │   └── upload/route.ts
│   │   ├── product/
│   │   │   └── custom/
│   │   │       └── page.tsx         # Bespoke customizer studio
│   │   ├── shop/
│   │   │   └── page.tsx             # Wall art catalog
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Editorial luxury homepage
│   ├── components/
│   │   ├── motion/                  # Reusable Framer Motion primitives
│   │   │   ├── FadeIn.tsx
│   │   │   ├── MagneticFrame.tsx
│   │   │   └── StaggerContainer.tsx
│   │   ├── Footer.tsx
│   │   ├── Hero.tsx
│   │   ├── Navbar.tsx
│   │   ├── PortraitBuilder.tsx      # Step-by-step soundwave & photo customizer
│   │   └── WaveformCanvas.tsx       # HTML5 2D canvas preview with template rendering
│   └── lib/
│       └── constants.ts             # Sizes, palettes, fonts, DECORATIVE_STYLES
├── tests/
│   ├── test_e2e_frontend_store.ts   # E2E test for multi-page routes, motion, customizer
│   ├── test_e2e_pdf_generation.py   # E2E test for 300 DPI PDF compilation across themes
│   └── run_all_tests.py             # Unified 4-tier E2E test runner
├── research_findings.md             # Market research artifact (Requirement R2)
├── TEST_INFRA.md                    # Test infrastructure specification
├── TEST_READY.md                    # Test suite completion attestation
└── PROJECT.md                       # Master project specification
```
