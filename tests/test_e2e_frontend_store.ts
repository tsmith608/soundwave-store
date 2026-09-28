/**
 * tests/test_e2e_frontend_store.ts
 * 
 * Comprehensive E2E Frontend Test Suite for SoundWave Art Store Restructuring.
 * Built according to the 4-Tier Test Architecture (TEST_INFRA.md):
 *   Tier 1: Feature Coverage (Multi-page routes, motion animations, research artifact, customizer templates)
 *   Tier 2: Boundary & Corner Cases (Deep-linking query params, invalid template fallbacks, hex formatting)
 *   Tier 3: Cross-Feature Combinations (Navigation links, shop presets deep-linking to customizer, checkout contract)
 *   Tier 4: Real-World Scenarios (End-to-end luxury customer purchase journey, design consistency)
 * 
 * Execution:
 *   npx tsx tests/test_e2e_frontend_store.ts
 *   npx.cmd tsx tests/test_e2e_frontend_store.ts (Windows)
 */

import * as fs from "fs";
import * as path from "path";

// Color formatting for console
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

interface TestRecord {
  tier: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const records: TestRecord[] = [];
const tierStats: Record<string, { total: number; passed: number; failed: number }> = {
  "Tier 1": { total: 0, passed: 0, failed: 0 },
  "Tier 2": { total: 0, passed: 0, failed: 0 },
  "Tier 3": { total: 0, passed: 0, failed: 0 },
  "Tier 4": { total: 0, passed: 0, failed: 0 },
};

function record(tier: string, name: string, passed: boolean, expected: string, actual: string, details?: string) {
  records.push({ tier, name, passed, expected, actual, details });
  if (!tierStats[tier]) {
    tierStats[tier] = { total: 0, passed: 0, failed: 0 };
  }
  tierStats[tier].total++;
  if (passed) {
    tierStats[tier].passed++;
    console.log(`  ${GREEN}✓ [PASS]${RESET} [${tier}] ${name}`);
  } else {
    tierStats[tier].failed++;
    console.log(`  ${RED}✗ [FAIL]${RESET} [${tier}] ${name}`);
    console.log(`         ${BOLD}Expected:${RESET} ${expected}`);
    console.log(`         ${BOLD}Actual:${RESET}   ${actual}`);
    if (details) console.log(`         ${YELLOW}Details:${RESET}  ${details}`);
  }
}

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Helper to read file safely
function readFileSafe(relPath: string): string | null {
  const full = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
}

// =========================================================================
// TIER 1: FEATURE COVERAGE (Core Requirements)
// =========================================================================
function runTier1() {
  console.log(`\n${CYAN}${BOLD}=== TIER 1: Core Feature Coverage ===${RESET}`);

  // F1. Multi-Page Routes
  // 1.1 Homepage route existence
  const homeCode = readFileSafe("src/app/page.tsx");
  record(
    "Tier 1",
    "F1.1: Homepage route file exists (src/app/page.tsx)",
    homeCode !== null,
    "File exists",
    homeCode !== null ? "File exists" : "File missing"
  );

  // 1.2 Shop catalog route existence
  const shopCode = readFileSafe("src/app/shop/page.tsx");
  record(
    "Tier 1",
    "F1.2: Wall art catalog route file exists (src/app/shop/page.tsx)",
    shopCode !== null,
    "File exists",
    shopCode !== null ? "File exists" : "File missing"
  );

  // 1.3 Bespoke customizer route existence
  const customCode = readFileSafe("src/app/product/custom/page.tsx");
  record(
    "Tier 1",
    "F1.3: Dedicated bespoke customizer studio route exists (src/app/product/custom/page.tsx)",
    customCode !== null,
    "File exists",
    customCode !== null ? "File exists" : "File missing"
  );

  // 1.4 Homepage exports valid React component and uses luxury cream tokens
  const homeValid = homeCode !== null && (homeCode.includes("export default function") || homeCode.includes("export default"));
  const homeHasLuxuryTokens = homeCode !== null && (homeCode.includes("#FAF7F2") || homeCode.includes("bg-[#FAF7F2]") || homeCode.includes("bg-cream"));
  record(
    "Tier 1",
    "F1.4: Homepage exports default component with luxury cream token styling",
    Boolean(homeValid && homeHasLuxuryTokens),
    "Default export with luxury styling #FAF7F2",
    `Export: ${homeValid}, Token styling: ${homeHasLuxuryTokens}`
  );

  // 1.5 Shop page exports valid React component with catalog grid
  const shopValid = shopCode !== null && (shopCode.includes("export default function") || shopCode.includes("export default"));
  const shopHasGrid = shopCode !== null && (shopCode.includes("PRESET_CATALOG") || shopCode.includes("catalog") || shopCode.includes("grid"));
  record(
    "Tier 1",
    "F1.5: Shop catalog route exports default component with preset grid",
    Boolean(shopValid && shopHasGrid),
    "Default export with catalog grid",
    `Export: ${shopValid}, Catalog grid: ${shopHasGrid}`
  );

  // 1.6 Customizer route hosts PortraitBuilder with Suspense hydration
  const customHasSuspense = customCode !== null && customCode.includes("Suspense") && customCode.includes("PortraitBuilder");
  record(
    "Tier 1",
    "F1.6: Customizer studio route hosts PortraitBuilder wrapped in Suspense",
    Boolean(customHasSuspense),
    "Suspense wrapping PortraitBuilder for query param hydration",
    `Contains Suspense and PortraitBuilder: ${customHasSuspense}`
  );

  // F2. Animation Library & Motion Layout Structure
  // 1.7 package.json contains framer-motion or motion
  const pkgJsonRaw = readFileSafe("package.json");
  let hasFramerMotion = false;
  let hasLucide = false;
  if (pkgJsonRaw) {
    try {
      const pkg = JSON.parse(pkgJsonRaw);
      hasFramerMotion = Boolean(
        (pkg.dependencies && (pkg.dependencies["framer-motion"] || pkg.dependencies["motion"])) ||
        (pkg.devDependencies && (pkg.devDependencies["framer-motion"] || pkg.devDependencies["motion"]))
      );
      hasLucide = Boolean(
        (pkg.dependencies && pkg.dependencies["lucide-react"]) ||
        (pkg.devDependencies && pkg.devDependencies["lucide-react"])
      );
    } catch (e) {}
  }
  record(
    "Tier 1",
    "F2.1: Animation library (framer-motion/motion) installed in package.json",
    hasFramerMotion,
    "framer-motion or motion listed in package.json",
    hasFramerMotion ? "Installed" : "Missing from package.json"
  );

  // 1.8 Lucide icons installed in package.json
  record(
    "Tier 1",
    "F2.2: Iconography library (lucide-react) installed in package.json",
    hasLucide,
    "lucide-react listed in package.json",
    hasLucide ? "Installed" : "Missing from package.json"
  );

  // 1.9 Motion primitives directory exists with FadeIn, MagneticFrame, StaggerContainer
  const fadeInCode = readFileSafe("src/components/motion/FadeIn.tsx");
  const magneticCode = readFileSafe("src/components/motion/MagneticFrame.tsx");
  const staggerCode = readFileSafe("src/components/motion/StaggerContainer.tsx");
  const primitivesExist = fadeInCode !== null && magneticCode !== null && staggerCode !== null;
  record(
    "Tier 1",
    "F2.3: Luxury motion primitives exist (FadeIn, MagneticFrame, StaggerContainer)",
    primitivesExist,
    "All three motion primitives exist under src/components/motion/",
    `FadeIn: ${fadeInCode !== null}, MagneticFrame: ${magneticCode !== null}, StaggerContainer: ${staggerCode !== null}`
  );

  // 1.10 Motion primitives import framer-motion
  const fadeInUsesMotion = fadeInCode !== null && (fadeInCode.includes('from "framer-motion"') || fadeInCode.includes("from 'framer-motion'"));
  const magneticUsesMotion = magneticCode !== null && (magneticCode.includes('from "framer-motion"') || magneticCode.includes("from 'framer-motion'"));
  record(
    "Tier 1",
    "F2.4: Motion primitives import and leverage framer-motion",
    Boolean(fadeInUsesMotion && magneticUsesMotion),
    "Primitives import framer-motion",
    `FadeIn imports: ${fadeInUsesMotion}, MagneticFrame imports: ${magneticUsesMotion}`
  );

  // F3. Aesthetic Market Research Artifact
  // 1.11 research_findings.md exists at project root
  const researchCode = readFileSafe("research_findings.md");
  record(
    "Tier 1",
    "F3.1: Market research artifact exists at project root (research_findings.md)",
    researchCode !== null,
    "research_findings.md exists",
    researchCode !== null ? "Exists" : "Missing"
  );

  // 1.12 research_findings.md documents at least 5 researched visual themes
  const requiredThemes = [
    "botanical",
    "modern_border",
    "arch",
    "art_deco",
    "vintage_grunge",
    "luxury_marble",
    "abstract_geometric",
    "celestial",
  ];
  let foundThemesInResearch = 0;
  if (researchCode) {
    for (const t of requiredThemes) {
      if (researchCode.toLowerCase().includes(t)) {
        foundThemesInResearch++;
      }
    }
  }
  record(
    "Tier 1",
    "F3.2: research_findings.md documents >= 5 distinct visual aesthetic themes",
    foundThemesInResearch >= 5,
    `At least 5 themes documented (target >= 5)`,
    `Found ${foundThemesInResearch} of 8 verified production themes`
  );

  // 1.13 research_findings.md includes color palettes and typography pairings
  const hasPalettes = researchCode !== null && (researchCode.includes("Palette") || researchCode.includes("Hex") || researchCode.includes("#"));
  const hasTypography = researchCode !== null && (researchCode.includes("Typography") || researchCode.includes("Font") || researchCode.includes("Serif"));
  record(
    "Tier 1",
    "F3.3: research_findings.md details color palettes and typography pairings",
    Boolean(hasPalettes && hasTypography),
    "Contains detailed palettes and typography specifications",
    `Palettes: ${hasPalettes}, Typography: ${hasTypography}`
  );

  // F4. Customizer Template Selection
  // 1.14 Customizer UI contains template/decoration selector section
  const pbCode = readFileSafe("src/components/PortraitBuilder.tsx");
  const pbHasStep2 = pbCode !== null && (pbCode.includes("Decorative Border Style") || pbCode.includes("DECORATIVE_STYLES") || pbCode.includes("decorativeStyle"));
  record(
    "Tier 1",
    "F4.1: PortraitBuilder contains dedicated aesthetic template/border selection UI",
    Boolean(pbHasStep2),
    "UI contains Decorative Border Style / Template selector",
    `Found template selection code in PortraitBuilder: ${pbHasStep2}`
  );

  // 1.15 Customizer allows selection across themes
  const constantsCode = readFileSafe("src/lib/constants.ts");
  let templateCount = 0;
  if (constantsCode) {
    const match = constantsCode.match(/DECORATIVE_STYLES\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/);
    if (match) {
      const block = match[1];
      const ids = block.match(/id:\s*["']([^"']+)["']/g);
      if (ids) {
        templateCount = ids.length;
      }
    }
  }
  // Also check shop catalog preset template choices
  let shopTemplateChoices = 0;
  if (shopCode) {
    const matchShop = shopCode.match(/template:\s*["']([^"']+)["']/g);
    if (matchShop) {
      const uniqueShopTemplates = new Set(matchShop.map(m => m.replace(/template:\s*["']/, "").replace(/["']/, "")));
      shopTemplateChoices = uniqueShopTemplates.size;
    }
  }
  record(
    "Tier 1",
    "F4.2: System supports selection between >= 5 distinct aesthetic templates",
    templateCount >= 5 || shopTemplateChoices >= 5,
    "Constants or catalog supports >= 5 distinct templates",
    `Constants count: ${templateCount}, Shop catalog unique templates: ${shopTemplateChoices}`
  );
}

// =========================================================================
// TIER 2: BOUNDARY & CORNER CASES
// =========================================================================
function runTier2() {
  console.log(`\n${CYAN}${BOLD}=== TIER 2: Boundary & Corner Cases ===${RESET}`);

  // 2.1 Deep-linking query parameter extraction on /product/custom
  const customCode = readFileSafe("src/app/product/custom/page.tsx");
  const extractsTemplateParam = customCode !== null && customCode.includes('searchParams.get("template")');
  const extractsPaletteParam = customCode !== null && customCode.includes('searchParams.get("palette")');
  const extractsSizeParam = customCode !== null && customCode.includes('searchParams.get("size")');
  record(
    "Tier 2",
    "B2.1: Customizer studio parses deep-linking query parameters (?template, ?palette, ?size)",
    Boolean(extractsTemplateParam && extractsPaletteParam && extractsSizeParam),
    "Extracts template, palette, and size from useSearchParams",
    `template: ${extractsTemplateParam}, palette: ${extractsPaletteParam}, size: ${extractsSizeParam}`
  );

  // 2.2 Unrecognized or empty template fallback handling
  const pbCode = readFileSafe("src/components/PortraitBuilder.tsx");
  const hasFallback = pbCode !== null && (
    pbCode.includes('return "botanical"') ||
    pbCode.includes("|| 'botanical'") ||
    pbCode.includes('|| "botanical"') ||
    pbCode.includes("DECORATIVE_STYLES[")
  );
  record(
    "Tier 2",
    "B2.2: PortraitBuilder falls back safely to default 'botanical' when template is unrecognized",
    Boolean(hasFallback),
    "Graceful fallback to default 'botanical' theme",
    `Has botanical fallback: ${hasFallback}`
  );

  // 2.3 Research findings hex color syntax validation
  const researchCode = readFileSafe("research_findings.md");
  let validHexCount = 0;
  if (researchCode) {
    const hexMatches = researchCode.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches) {
      validHexCount = hexMatches.length;
    }
  }
  record(
    "Tier 2",
    "B2.3: research_findings.md contains valid 6-character hex color codes (>= 20 occurrences)",
    validHexCount >= 20,
    ">= 20 valid #RRGGBB hex color codes",
    `Found ${validHexCount} valid 6-char hex color codes`
  );

  // 2.4 Motion primitive direction boundary handling (none, up, down, left, right)
  const fadeInCode = readFileSafe("src/components/motion/FadeIn.tsx");
  const handlesDirections = fadeInCode !== null &&
    fadeInCode.includes('"up"') &&
    fadeInCode.includes('"down"') &&
    fadeInCode.includes('"left"') &&
    fadeInCode.includes('"right"') &&
    fadeInCode.includes('"none"');
  record(
    "Tier 2",
    "B2.4: FadeIn primitive handles all 5 directional variants (up, down, left, right, none)",
    Boolean(handlesDirections),
    "Supports 'up' | 'down' | 'left' | 'right' | 'none'",
    `Direction variants verified: ${handlesDirections}`
  );

  // 2.5 Customizer photo file upload type validation
  const acceptsImages = pbCode !== null && pbCode.includes('accept=".jpg,.jpeg,.png,image/jpeg,image/png"');
  const limitsSize = pbCode !== null && (pbCode.includes("25 * 1024 * 1024") || pbCode.includes("25MB"));
  record(
    "Tier 2",
    "B2.5: PortraitBuilder validates file input format (.jpg, .jpeg, .png) and 25MB boundary limit",
    Boolean(acceptsImages && limitsSize),
    "Accept attribute matches image types and enforces 25MB boundary limit",
    `Accepts images: ${acceptsImages}, Limits size: ${limitsSize}`
  );
}

// =========================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// =========================================================================
function runTier3() {
  console.log(`\n${CYAN}${BOLD}=== TIER 3: Cross-Feature Combinations ===${RESET}`);

  // 3.1 Navbar navigation connects multi-page routes
  const navCode = readFileSafe("src/components/Navbar.tsx");
  const navHasHome = navCode !== null && navCode.includes('href="/"');
  const navHasShop = navCode !== null && navCode.includes('href="/shop"');
  const navHasCustom = navCode !== null && navCode.includes('href="/product/custom"');
  record(
    "Tier 3",
    "C3.1: Navbar connects all primary multi-page routes ('/', '/shop', '/product/custom')",
    Boolean(navHasHome && navHasShop && navHasCustom),
    "Navbar links to '/', '/shop', and '/product/custom'",
    `Home: ${navHasHome}, Shop: ${navHasShop}, Custom: ${navHasCustom}`
  );

  // 3.2 Footer navigation connects multi-page routes
  const footCode = readFileSafe("src/components/Footer.tsx");
  const footHasCustom = footCode !== null && footCode.includes('href="/product/custom"');
  const footHasShop = footCode !== null && footCode.includes('href="/shop"');
  record(
    "Tier 3",
    "C3.2: Footer links to wall art catalog and bespoke customizer studio",
    Boolean(footHasCustom && footHasShop),
    "Footer links to '/shop' and '/product/custom'",
    `Customizer link: ${footHasCustom}, Shop link: ${footHasShop}`
  );

  // 3.3 Shop catalog cards deep-link to customizer with query parameter
  const shopCode = readFileSafe("src/app/shop/page.tsx");
  const shopHasDeepLinks = shopCode !== null && (
    shopCode.includes("/product/custom?template=") ||
    shopCode.includes("/product/custom?preset=") ||
    shopCode.includes("/product/custom?")
  );
  record(
    "Tier 3",
    "C3.3: Shop catalog preset cards deep-link to /product/custom with template query params",
    Boolean(shopHasDeepLinks),
    "Catalog cards pass template parameter into /product/custom",
    `Deep linking configured: ${shopHasDeepLinks}`
  );

  // 3.4 Customizer passes decorativeStyle to WaveformCanvas
  const pbCode = readFileSafe("src/components/PortraitBuilder.tsx");
  const canvasIntegration = pbCode !== null && pbCode.includes("<WaveformCanvas") && pbCode.includes("decorativeStyle={decorativeStyle}");
  record(
    "Tier 3",
    "C3.4: Customizer passes selected decorativeStyle directly to WaveformCanvas for real-time preview",
    Boolean(canvasIntegration),
    "WaveformCanvas receives decorativeStyle={decorativeStyle}",
    `Canvas receives decorativeStyle: ${canvasIntegration}`
  );

  // 3.5 Customizer submits decorativeStyle in checkout payload
  const checkoutPayloadContinuity = pbCode !== null && (
    pbCode.includes("decorativeStyle") || pbCode.includes("decorativeTheme")
  ) && pbCode.includes("/api/checkout");
  record(
    "Tier 3",
    "C3.5: Customizer submits selected decorative theme in /api/checkout payload",
    Boolean(checkoutPayloadContinuity),
    "Payload sent to /api/checkout includes decorative style/theme",
    `Continuity confirmed: ${checkoutPayloadContinuity}`
  );
}

// =========================================================================
// TIER 4: REAL-WORLD SCENARIOS & WORKFLOWS
// =========================================================================
function runTier4() {
  console.log(`\n${CYAN}${BOLD}=== TIER 4: Real-World Scenarios & Workflows ===${RESET}`);

  // 4.1 End-to-end luxury customer discovery journey
  // Homepage has CTAs leading to /shop or /product/custom
  const homeCode = readFileSafe("src/app/page.tsx");
  const navCode = readFileSafe("src/components/Navbar.tsx");
  const heroCode = readFileSafe("src/components/Hero.tsx");
  const discoveryCTA = (
    (homeCode && (homeCode.includes("/shop") || homeCode.includes("/product/custom"))) ||
    (navCode && (navCode.includes("/shop") || navCode.includes("/product/custom"))) ||
    (heroCode && (heroCode.includes("/shop") || heroCode.includes("/product/custom") || heroCode.includes("#builder")))
  );
  record(
    "Tier 4",
    "S4.1: Customer discovery journey: Editorial homepage directs traffic to catalog and customizer",
    Boolean(discoveryCTA),
    "Editorial homepage or Hero links to /shop or /product/custom",
    `Discovery pathways verified: ${discoveryCTA}`
  );

  // 4.2 Shop catalog category filtering scenario
  const shopCode = readFileSafe("src/app/shop/page.tsx");
  const hasCategoryFilters = shopCode !== null && (
    shopCode.includes("selectedCategory") ||
    shopCode.includes("activeCategory") ||
    shopCode.includes("filter")
  );
  record(
    "Tier 4",
    "S4.2: Catalog curation workflow: Shop provides interactive category filtering across aesthetic genres",
    Boolean(hasCategoryFilters),
    "Shop page provides category filtering state and UI",
    `Category filtering present: ${hasCategoryFilters}`
  );

  // 4.3 Luxury craftsmanship and trust marker presentation
  const customCode = readFileSafe("src/app/product/custom/page.tsx");
  const hasCraftsmanship = customCode !== null && (
    customCode.includes("300 DPI") ||
    customCode.includes("Solid Wood") ||
    customCode.includes("Archival")
  );
  record(
    "Tier 4",
    "S4.3: Customizer studio presents luxury craftsmanship assurances (300 DPI, Solid Wood, Archival)",
    Boolean(hasCraftsmanship),
    "Studio presents museum-grade craftsmanship narrative",
    `Craftsmanship narrative present: ${hasCraftsmanship}`
  );

  // 4.4 Consistency between research findings and UI color tokens
  const researchCode = readFileSafe("research_findings.md");
  const layoutCode = readFileSafe("src/app/layout.tsx");
  const globalsCode = readFileSafe("src/app/globals.css");
  const researchAlabaster = researchCode !== null && researchCode.includes("#FAF7F2");
  const layoutAlabaster = layoutCode !== null && layoutCode.includes("#FAF7F2");
  const globalsAlabaster = globalsCode !== null && globalsCode.includes("#FAF7F2");
  record(
    "Tier 4",
    "S4.4: Aesthetic design token consistency: Alabaster cream (#FAF7F2) unified across research, layout, and CSS",
    Boolean(researchAlabaster && (layoutAlabaster || globalsAlabaster)),
    "#FAF7F2 defined in research_findings.md and applied in layout/CSS",
    `Research: ${researchAlabaster}, Layout: ${layoutAlabaster}, CSS: ${globalsAlabaster}`
  );
}

// =========================================================================
// MAIN RUNNER & SUMMARY
// =========================================================================
function main() {
  console.log("================================================================================");
  console.log("       SOUNDWAVE ART — FRONTEND E2E TEST SUITE (TIERS 1-4)");
  console.log("================================================================================");

  runTier1();
  runTier2();
  runTier3();
  runTier4();

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`${BOLD}${"Test Tier".padEnd(25)} | ${"Total".padEnd(8)} | ${"Pass".padEnd(8)} | ${"Fail".padEnd(8)} | ${"Status".padEnd(10)}${RESET}`);
  console.log("--------------------------------------------------------------------------------");

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  for (const [tier, stats] of Object.entries(tierStats)) {
    grandTotal += stats.total;
    grandPassed += stats.passed;
    grandFailed += stats.failed;
    const status = stats.failed === 0 ? `${GREEN}[OK]${RESET}` : `${RED}[FAIL]${RESET}`;
    console.log(`${tier.padEnd(25)} | ${String(stats.total).padEnd(8)} | ${String(stats.passed).padEnd(8)} | ${String(stats.failed).padEnd(8)} | ${status}`);
  }

  console.log("--------------------------------------------------------------------------------");
  const overallStatus = grandFailed === 0 ? `${GREEN}${BOLD}PASSED (100%)${RESET}` : `${RED}${BOLD}FAILED (${grandFailed} errors)${RESET}`;
  console.log(`${BOLD}${"OVERALL TOTALS".padEnd(25)} | ${String(grandTotal).padEnd(8)} | ${String(grandPassed).padEnd(8)} | ${String(grandFailed).padEnd(8)} | ${overallStatus}${RESET}`);
  console.log("================================================================================\n");

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({
      suite: "frontend_e2e",
      total: grandTotal,
      passed: grandPassed,
      failed: grandFailed,
      tiers: tierStats,
      records,
    }));
  }

  if (grandFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
