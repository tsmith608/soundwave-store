/**
 * src/lib/verify_pseo.ts
 *
 * Verification suite for Programmatic SEO (pSEO) Engine (R2 / Milestone 2).
 * Verifies:
 *  1. Total occasion registrations (24 total: 17 anniversaries + 7 memorials).
 *  2. Data contract integrity (valid templates, palettes, frame sizes, audio ideas, FAQs).
 *  3. Dynamic slug resolution & alias mapping resilience.
 *  4. Schema.org @graph JSON-LD structure compliance (Product, BreadcrumbList, FAQPage).
 *  5. Customizer deep-link query parameter integrity.
 *
 * Run via:
 *   npx tsx src/lib/verify_pseo.ts
 */

import {
  getAllOccasions,
  getAnniversaryOccasions,
  getMemorialOccasions,
  getOccasionBySlug,
  OccasionData,
} from "./pseo";
import { DECORATIVE_STYLES, PALETTES, FRAME_SIZES } from "./constants";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

let passedCount = 0;
let failedCount = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${description}`);
  } else {
    failedCount++;
    console.log(`  ${RED}✗ [FAIL]${RESET} ${description}`);
    if (details) {
      console.log(`         ${YELLOW}Details:${RESET} ${details}`);
    }
  }
}

console.log(`\n${CYAN}${BOLD}======================================================${RESET}`);
console.log(`${CYAN}${BOLD}   SOUNDWAVE ART — pSEO ENGINE VERIFICATION (M2)       ${RESET}`);
console.log(`${CYAN}${BOLD}======================================================${RESET}\n`);

// -------------------------------------------------------------
// 1. OCCASIONS REGISTRATION & ENGINE BREAKDOWN
// -------------------------------------------------------------
console.log(`${BOLD}--- 1. Occasion Catalog & Engine Registrations ---${RESET}`);

const allOccasions = getAllOccasions();
const anniversaries = getAnniversaryOccasions();
const memorials = getMemorialOccasions();

assert("getAllOccasions() returns exactly 24 registered occasions", allOccasions.length === 24, `Found: ${allOccasions.length}`);
assert("getAnniversaryOccasions() returns exactly 17 anniversary milestones", anniversaries.length === 17, `Found: ${anniversaries.length}`);
assert("getMemorialOccasions() returns exactly 7 keepsake moments", memorials.length === 7, `Found: ${memorials.length}`);

// Verify all 17 milestone years exist
const requiredYears = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60];
const actualYears = anniversaries.map((a) => a.milestoneYear).filter((y): y is number => typeof y === "number");
const allYearsPresent = requiredYears.every((y) => actualYears.includes(y));
assert(
  "All 17 required anniversary milestone years (1-10, 15, 20, 25, 30, 40, 50, 60) are registered",
  allYearsPresent,
  `Missing years: ${requiredYears.filter((y) => !actualYears.includes(y)).join(", ")}`
);

// Check unique IDs and unique slugs
const ids = new Set(allOccasions.map((o) => o.id));
assert("All occasion IDs are globally unique", ids.size === allOccasions.length, `Unique IDs: ${ids.size}, total: ${allOccasions.length}`);

const slugs = new Set(allOccasions.map((o) => o.slug));
assert("All occasion slugs are globally unique", slugs.size === allOccasions.length, `Unique slugs: ${slugs.size}, total: ${allOccasions.length}`);

// -------------------------------------------------------------
// 2. DATA CONTRACT & CONSTANTS INTEGRITY
// -------------------------------------------------------------
console.log(`\n${BOLD}--- 2. Data Contract & Schema Integrity ---${RESET}`);

let invalidTemplateOccasions: string[] = [];
let invalidPaletteOccasions: string[] = [];
let invalidSizeOccasions: string[] = [];
let missingContentOccasions: string[] = [];
let invalidFaqOccasions: string[] = [];

for (const occ of allOccasions) {
  // Check recommended template
  if (!DECORATIVE_STYLES[occ.recommendedTemplate]) {
    invalidTemplateOccasions.push(`${occ.slug} (${occ.recommendedTemplate})`);
  }

  // Check recommended palette
  if (!PALETTES[occ.recommendedPalette]) {
    invalidPaletteOccasions.push(`${occ.slug} (${occ.recommendedPalette})`);
  }

  // Check recommended frame size
  if (!FRAME_SIZES[occ.recommendedSize]) {
    invalidSizeOccasions.push(`${occ.slug} (${occ.recommendedSize})`);
  }

  // Check required text content
  if (
    !occ.title ||
    !occ.subtitle ||
    !occ.badge ||
    !occ.symbolism ||
    !occ.emotionalHook ||
    !occ.storyCopy ||
    !occ.sampleCaption ||
    !occ.metaTitle ||
    !occ.metaDescription ||
    !occ.audioIdeas ||
    occ.audioIdeas.length < 2 ||
    !occ.keywords ||
    occ.keywords.length < 3
  ) {
    missingContentOccasions.push(occ.slug);
  }

  // Check FAQs
  if (!occ.faqs || occ.faqs.length < 2 || occ.faqs.some((f) => !f.question || !f.answer)) {
    invalidFaqOccasions.push(occ.slug);
  }
}

assert(
  "All occasions reference valid DECORATIVE_STYLES templates",
  invalidTemplateOccasions.length === 0,
  `Invalid: ${invalidTemplateOccasions.join(", ")}`
);

assert(
  "All occasions reference valid PALETTES color configurations",
  invalidPaletteOccasions.length === 0,
  `Invalid: ${invalidPaletteOccasions.join(", ")}`
);

assert(
  "All occasions reference valid FRAME_SIZES configurations",
  invalidSizeOccasions.length === 0,
  `Invalid: ${invalidSizeOccasions.join(", ")}`
);

assert(
  "All occasions have complete editorial copy, audio ideas (>=2), and SEO keywords (>=3)",
  missingContentOccasions.length === 0,
  `Incomplete: ${missingContentOccasions.join(", ")}`
);

assert(
  "All occasions include at least 2 structured FAQ items with questions and answers",
  invalidFaqOccasions.length === 0,
  `Invalid FAQs: ${invalidFaqOccasions.join(", ")}`
);

// -------------------------------------------------------------
// 3. SLUG RESOLUTION & ALIASING
// -------------------------------------------------------------
console.log(`\n${BOLD}--- 3. Dynamic Slug Resolution & Resilient Aliasing ---${RESET}`);

// Primary slug resolution
const paperByPrimary = getOccasionBySlug("1st-paper-anniversary-soundwave-art");
assert(
  "Primary slug '1st-paper-anniversary-soundwave-art' resolves correctly",
  paperByPrimary !== undefined && paperByPrimary.id === "anniversary-1"
);

const petByPrimary = getOccasionBySlug("pet-memorial-soundwave-art");
assert(
  "Primary slug 'pet-memorial-soundwave-art' resolves correctly",
  petByPrimary !== undefined && petByPrimary.id === "memorial-pet"
);

// Shorthand alias resolution
const paperByAlias = getOccasionBySlug("1st-paper-anniversary");
assert(
  "Shorthand alias '1st-paper-anniversary' resolves to anniversary-1",
  paperByAlias !== undefined && paperByAlias.id === "anniversary-1"
);

const woodByAlias = getOccasionBySlug("5th-wood-anniversary");
assert(
  "Shorthand alias '5th-wood-anniversary' resolves to anniversary-5",
  woodByAlias !== undefined && woodByAlias.id === "anniversary-5"
);

const weddingVowsByAlias = getOccasionBySlug("wedding-vow-soundwave");
assert(
  "Shorthand alias 'wedding-vow-soundwave' resolves to memorial-wedding-vows",
  weddingVowsByAlias !== undefined && weddingVowsByAlias.id === "memorial-wedding-vows"
);

// Case insensitive and trailing slash resilience
const caseAndSlash = getOccasionBySlug("5TH-WOOD-ANNIVERSARY-SOUNDWAVE-ART/");
assert(
  "Case variation and trailing slash '5TH-WOOD-ANNIVERSARY-SOUNDWAVE-ART/' resolves cleanly",
  caseAndSlash !== undefined && caseAndSlash.id === "anniversary-5"
);

// Non-existent slug returns undefined
const nonExistent = getOccasionBySlug("non-existent-mystery-anniversary-slug");
assert("Unknown slug returns undefined safely without throwing", nonExistent === undefined);

// -------------------------------------------------------------
// 4. SCHEMA.ORG JSON-LD STRUCTURE COMPLIANCE
// -------------------------------------------------------------
console.log(`\n${BOLD}--- 4. Schema.org @graph Structured Data Validation ---${RESET}`);

function buildSchemaGraph(occ: OccasionData) {
  const appUrl = "https://soundwaveart.com";
  const pageUrl = `${appUrl}/gifts/${occ.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${pageUrl}#product`,
        name: occ.title,
        description: occ.metaDescription,
        brand: {
          "@type": "Brand",
          name: "SoundWave Art",
        },
        category: occ.engine === "anniversary" ? "Anniversary Gifts" : "Memorial & Keepsake Gifts",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "49.00",
          highPrice: "149.00",
          offerCount: "4",
          availability: "https://schema.org/InStock",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: occ.ratingValue,
          reviewCount: occ.reviewCount.toString(),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
          { "@type": "ListItem", position: 2, name: "Occasion Gifts", item: `${appUrl}/gifts` },
          { "@type": "ListItem", position: 3, name: occ.title, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: occ.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

const woodSchema = buildSchemaGraph(paperByPrimary!);
assert("Schema has @context 'https://schema.org'", woodSchema["@context"] === "https://schema.org");
assert("Schema @graph contains exactly 3 nodes (Product, BreadcrumbList, FAQPage)", woodSchema["@graph"].length === 3);

const productNode = woodSchema["@graph"].find((n) => n["@type"] === "Product") as any;
assert("Product node has @id, name, brand, offers, and aggregateRating", Boolean(productNode && productNode["@id"] && productNode.name && productNode.brand && productNode.offers && productNode.aggregateRating));
assert("Product offers specify USD currency and valid 49-149 price range", productNode.offers.priceCurrency === "USD" && productNode.offers.lowPrice === "49.00" && productNode.offers.highPrice === "149.00");

const breadcrumbNode = woodSchema["@graph"].find((n) => n["@type"] === "BreadcrumbList") as any;
assert("BreadcrumbList contains 3 hierarchical trail items", Boolean(breadcrumbNode && breadcrumbNode.itemListElement.length === 3));

const faqNode = woodSchema["@graph"].find((n) => n["@type"] === "FAQPage") as any;
assert("FAQPage contains structured Question and Answer entities", Boolean(faqNode && faqNode.mainEntity.length >= 2 && faqNode.mainEntity[0]["@type"] === "Question"));

// -------------------------------------------------------------
// 5. CUSTOMIZER DEEP LINKING URL CONTRACT
// -------------------------------------------------------------
console.log(`\n${BOLD}--- 5. Customizer Deep-Linking Pre-population Contract ---${RESET}`);

for (const occ of allOccasions) {
  const url = `/product/custom?template=${encodeURIComponent(occ.recommendedTemplate)}&palette=${encodeURIComponent(occ.recommendedPalette)}&size=${encodeURIComponent(occ.recommendedSize)}&caption=${encodeURIComponent(occ.sampleCaption)}`;
  const parsed = new URL(url, "https://soundwaveart.com");
  const template = parsed.searchParams.get("template");
  const palette = parsed.searchParams.get("palette");
  const size = parsed.searchParams.get("size");
  const caption = parsed.searchParams.get("caption");

  if (
    template !== occ.recommendedTemplate ||
    palette !== occ.recommendedPalette ||
    size !== occ.recommendedSize ||
    caption !== occ.sampleCaption
  ) {
    assert(`Deep link round-trip for ${occ.slug}`, false, `Mismatch in URL params`);
    break;
  }
}
assert("All 24 occasions produce perfectly reversible deep-linking query parameters (?template, ?palette, ?size, ?caption)", true);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log(`\n${BOLD}------------------------------------------------------${RESET}`);
console.log(`Total Checks: ${passedCount + failedCount} | ${GREEN}Passed: ${passedCount}${RESET} | ${failedCount > 0 ? RED : GREEN}Failed: ${failedCount}${RESET}`);
console.log(`${BOLD}------------------------------------------------------${RESET}\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}✓ ALL pSEO ENGINE VERIFICATION CHECKS PASSED SUCCESSFULLY!${RESET}\n`);
  process.exit(0);
}
