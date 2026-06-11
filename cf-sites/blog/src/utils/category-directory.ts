import type { Category, SiteConfig } from '../types.js';
import { buildCategorySeoMeta } from './seo.js';

export interface CategoryDirectoryEntry {
  slug: string;
  name: string;
  href: string;
  description: string;
  count: number;
}

const DEFAULT_FOCUS_CATEGORY_SLUGS = ['a-stocks', 'us-stocks', 'hk-stocks', 'crypto'];
const DEFAULT_SUPPORT_CATEGORY_SLUGS = ['ai-stocks', 'industry-research', 'macro', 'investing-101'];

function buildCategoryPath(config: SiteConfig, slug: string): string {
  const prefix = config.routes?.category || 'category';
  return `/${prefix}/${slug}`;
}

export function buildCategoryDirectoryEntries(
  config: SiteConfig,
  categories: Category[],
  preferredSlugs: string[],
): CategoryDirectoryEntry[] {
  const categoryMap = new Map(categories.map((category) => [category.slug, category]));

  return preferredSlugs.reduce<CategoryDirectoryEntry[]>((entries, slug) => {
    const category = categoryMap.get(slug);
    if (!category) return entries;

    const seoMeta = buildCategorySeoMeta(config, category.slug, category.name, category.description);
    entries.push({
      slug: category.slug,
      name: category.name,
      href: buildCategoryPath(config, category.slug),
      description: category.description || seoMeta.description,
      count: category.count,
    });
    return entries;
  }, []);
}

export function buildMarketDirectoryEntries(config: SiteConfig, categories: Category[]): CategoryDirectoryEntry[] {
  const preferredSlugs = (config.home?.focusCategories || DEFAULT_FOCUS_CATEGORY_SLUGS).filter(Boolean);
  return buildCategoryDirectoryEntries(config, categories, preferredSlugs);
}

export function buildSupportDirectoryEntries(
  config: SiteConfig,
  categories: Category[],
  excludeSlugs: string[] = [],
): CategoryDirectoryEntry[] {
  const exclude = new Set(excludeSlugs);
  return buildCategoryDirectoryEntries(config, categories, DEFAULT_SUPPORT_CATEGORY_SLUGS.filter((slug) => !exclude.has(slug)));
}
