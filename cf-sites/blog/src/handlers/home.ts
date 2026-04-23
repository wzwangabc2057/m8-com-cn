
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCategories, getTags, getCollections, getAuthors } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';

import {
  buildHomeSeo,
  buildWebSiteSchema,
  buildOrganizationSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { isUncategorized, enrichPostsWithCategoryDisplayNames } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

export async function handleHome(env: Env, page: number): Promise<Response> {
  const [config, categories, tags, collections, authors, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getTags(env.CONTENT_BUCKET, env.SITE_ID),
    getCollections(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  // Load posts from D1 (paginated)
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage
  );

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);
  const pagination = buildPagination(total, page, config.postsPerPage, '');

  // Featured: configurable count (default: 3)
  const featuredCount = config.blog?.featuredCount ?? 3;
  const showFeatured = config.blog?.showFeatured !== false;
  
  // For featured posts on subsequent pages, we fetch page 1 again
  let featuredPosts = posts;
  if (showFeatured && page > 1) {
    const p1 = await getPosts(env.DB, env.SITE_ID, 1, featuredCount);
    featuredPosts = p1.posts;
  }
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const enrichAuthor = (p: typeof posts[0]) => ({
    ...p,
    authorDisplayName: authorMap.get(p.author)?.name || p.author,
  });
  const featured = showFeatured ? featuredPosts.slice(0, featuredCount).map(enrichAuthor) : [];
  const postsWithAuthor = posts.map(enrichAuthor);

  // Home config
  const homeConfig = config.home || {};
  const defaultImages = config.defaults || {};

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  // Apply default images and localized name for "uncategorized" (未分类 etc.)
  const categoriesWithDefaults = categories.map((cat) => ({
    ...cat,
    name: isUncategorized(cat.slug) ? labels.uncategorized : cat.name,
    featuredImage: cat.featuredImage || defaultImages.category || '',
  }));
  const postsWithAuthorAndCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    postsWithAuthor,
    categories,
    labels.uncategorized,
  );

  const seo = buildHomeSeo(config, env.EFFECTIVE_ORIGIN);
  // Use home hero image or default OG image
  if (homeConfig.heroImage) seo.ogImage = homeConfig.heroImage;

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const schema: Record<string, unknown> = {
    website: buildWebSiteSchema(config, base),
  };
  if (page === 1) {
    schema.organization = buildOrganizationSchema(config, base);
  }

  const html = render(config.theme || 'default', 'home', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: homeConfig.title || config.name,
    pageDescription: homeConfig.subtitle || config.description,
    seo,
    schema,
    handler: 'home',
    showHeader: true,
    showFooter: true,
    customPartials,
    // Home config
    heroTitle: homeConfig.title || config.name,
    heroSubtitle: homeConfig.subtitle || config.description,
    heroImage: homeConfig.heroImage || '',
    showCategories: homeConfig.showCategories !== false,
    showTags: homeConfig.showTags !== false,
    showStats: homeConfig.showStats !== false,
    showFeatured,
    postsLayout: config.blog?.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    featured,
    categories: categoriesWithDefaults,
    tags,
    collections,
    pagination,
    totalPosts: total,
    preloadImage: homeConfig.heroImage || seo.ogImage,
  });

  return htmlResponse(html);
}
