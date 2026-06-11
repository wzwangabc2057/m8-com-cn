import type { Category, PostSummary, SiteConfig, Tag } from '../types.js';
import { buildCategorySeoMeta } from './seo.js';

export interface TaxonomyLinkEntry {
  slug: string;
  name: string;
  href: string;
  count: number;
  description?: string;
}

function buildCategoryPath(config: SiteConfig, slug: string): string {
  const prefix = config.routes?.category || 'category';
  return `/${prefix}/${encodeURIComponent(slug)}`;
}

function buildTagPath(config: SiteConfig, slug: string): string {
  const prefix = config.routes?.tag || 'tag';
  return `/${prefix}/${encodeURIComponent(slug)}`;
}

function sortByCount(entries: TaxonomyLinkEntry[]): TaxonomyLinkEntry[] {
  return entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

export function buildCategoryLinksFromPosts(
  config: SiteConfig,
  categories: Category[],
  posts: PostSummary[],
  limit = 6,
  excludeSlugs: string[] = [],
): TaxonomyLinkEntry[] {
  const excluded = new Set(excludeSlugs);
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const slug of post.categories || []) {
      if (!slug || excluded.has(slug)) continue;
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
  }

  const categoryMap = new Map(categories.map((category) => [category.slug, category]));
  return sortByCount(
    [...counts.entries()].map(([slug, count]) => {
      const category = categoryMap.get(slug);
      const name = category?.name || slug;
      return {
        slug,
        name,
        href: buildCategoryPath(config, slug),
        count,
        description: category?.description || buildCategorySeoMeta(config, slug, name, category?.description).description,
      };
    }),
  ).slice(0, limit);
}

export function buildTagLinksFromPosts(
  config: SiteConfig,
  tags: Tag[],
  posts: PostSummary[],
  limit = 8,
  excludeSlugs: string[] = [],
): TaxonomyLinkEntry[] {
  const excluded = new Set(excludeSlugs);
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const slug of post.tags || []) {
      if (!slug || excluded.has(slug)) continue;
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
  }

  const tagMap = new Map(tags.map((tag) => [tag.slug, tag]));
  return sortByCount(
    [...counts.entries()].map(([slug, count]) => {
      const tag = tagMap.get(slug);
      return {
        slug,
        name: tag?.name || slug,
        href: buildTagPath(config, slug),
        count,
        description: tag?.description || '',
      };
    }),
  ).slice(0, limit);
}
