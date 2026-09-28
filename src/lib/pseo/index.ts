/**
 * DEPRECATED (Sep 2026): the /gifts/[slug] pages built from this data were
 * removed in the memory-first pivot (song-led copy). The data is kept only
 * because tests/test_sprint2_unified.ts covers it; do not render it again
 * without rewriting it to docs/seo-memory-positioning.md.
 */
import { OccasionData } from "./types";
import { ANNIVERSARY_OCCASIONS } from "./anniversaries";
import { MEMORIAL_OCCASIONS } from "./memorials";

export * from "./types";
export { ANNIVERSARY_OCCASIONS } from "./anniversaries";
export { MEMORIAL_OCCASIONS } from "./memorials";

/**
 * Returns all occasions across both engines (17 Anniversaries + 7 Memorials = 24 total).
 */
export function getAllOccasions(): OccasionData[] {
  return [...ANNIVERSARY_OCCASIONS, ...MEMORIAL_OCCASIONS];
}

/**
 * Returns all anniversary engine occasions (17 milestones).
 */
export function getAnniversaryOccasions(): OccasionData[] {
  return ANNIVERSARY_OCCASIONS;
}

/**
 * Returns all memorial & keepsake engine occasions (7 moments).
 */
export function getMemorialOccasions(): OccasionData[] {
  return MEMORIAL_OCCASIONS;
}

/**
 * Resolves an occasion by primary canonical slug or alias.
 * Supports case-insensitivity, trailing slashes, and shorthand forms.
 */
export function getOccasionBySlug(slug: string): OccasionData | undefined {
  if (!slug) return undefined;

  const normalized = slug.trim().toLowerCase().replace(/\/+$/, "");

  const all = getAllOccasions();

  // 1. Direct match on primary slug
  const directMatch = all.find((occ) => occ.slug.toLowerCase() === normalized);
  if (directMatch) return directMatch;

  // 2. Direct match on declared aliases
  const aliasMatch = all.find((occ) =>
    occ.aliases.some((alias) => alias.toLowerCase() === normalized)
  );
  if (aliasMatch) return aliasMatch;

  // 3. Fallback: Check without '-soundwave-art' or with '-soundwave-art'
  const withSuffix = normalized.endsWith("-soundwave-art")
    ? normalized
    : `${normalized}-soundwave-art`;
  const withoutSuffix = normalized.endsWith("-soundwave-art")
    ? normalized.replace(/-soundwave-art$/, "")
    : normalized;

  const suffixMatch = all.find(
    (occ) =>
      occ.slug.toLowerCase() === withSuffix ||
      occ.slug.toLowerCase() === withoutSuffix ||
      occ.aliases.some(
        (a) => a.toLowerCase() === withSuffix || a.toLowerCase() === withoutSuffix
      )
  );
  if (suffixMatch) return suffixMatch;

  return undefined;
}
