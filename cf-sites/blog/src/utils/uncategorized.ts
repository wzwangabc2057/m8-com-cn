/**
 * Canonical slug and display handling for "uncategorized" category.
 * Ensures 未分类 / Uncategorized etc. are treated as one logical category
 * and can be shown in the site's language.
 */

/** Canonical slug to use when storing/syncing (e.g. in D1). */
export const UNCATEGORIZED_SLUG = 'uncategorized';

/** Slugs/labels that should be treated as uncategorized for display. */
const UNCATEGORIZED_ALIASES = new Set([
  'uncategorized',
  '未分类',
  'Uncategorized',
  '未分類', // ja
]);

export function isUncategorized(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return UNCATEGORIZED_ALIASES.has(slug.trim());
}

export interface CategoryLike {
  slug: string;
  name?: string;
}

/** Decode percent-encoded string for display; safe no-op if not encoded. */
export function safeDecodeForDisplay(s: string): string {
  if (!s || typeof s !== 'string' || !/%[0-9A-Fa-f]{2}/.test(s)) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Resolve display name for a category slug: use localized "uncategorized"
 * when slug is an alias, otherwise name from meta or slug.
 * Handles URL-encoded slugs (e.g. %e7%95%99%e5%ad%a6...) for lookup and display.
 */
export function resolveCategoryDisplayName(
  slug: string,
  categories: CategoryLike[],
  uncategorizedLabel: string,
): string {
  if (isUncategorized(slug)) return uncategorizedLabel;
  const decoded = safeDecodeForDisplay(slug);
  const cat = categories.find((c) => c.slug === slug || c.slug === decoded);
  return cat?.name ?? decoded;
}

/**
 * Enrich posts with categoryDisplayNames (same length/order as categories)
 * for template display, so "未分类" shows in the site language.
 */
export function enrichPostsWithCategoryDisplayNames<T extends { categories?: string[] }>(
  posts: T[],
  categories: CategoryLike[],
  uncategorizedLabel: string,
): (T & { categoryDisplayNames: string[] })[] {
  return posts.map((p) => ({
    ...p,
    categoryDisplayNames: (p.categories || []).map((slug) =>
      resolveCategoryDisplayName(slug, categories, uncategorizedLabel),
    ),
  }));
}
