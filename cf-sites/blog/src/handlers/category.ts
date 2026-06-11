
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCategories, getAuthors } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';
import { enrichPostsWithAuthorIdentity } from '../utils/authors.js';
import { buildMarketDirectoryEntries, buildSupportDirectoryEntries } from '../utils/category-directory.js';

import {
  buildBreadcrumbSchema,
  buildListSeo,
  buildWebSiteSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { isUncategorized, enrichPostsWithCategoryDisplayNames, safeDecodeForDisplay } from '../utils/uncategorized.js';
import type { Category, Env } from '../types.js';

/** Find category by slug or name; handles encoded slugs and name fallback. */
function findCategory(categories: Category[], slug: string) {
  const decoded = safeDecodeForDisplay(slug);
  return (
    categories.find((c) => c.slug === slug || c.slug === decoded) ??
    categories.find((c) => c.name === slug || c.name === decoded)
  );
}

export async function handleCategory(env: Env, slug: string, page: number): Promise<Response | null> {
  const [config, categoriesRaw, authors, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  // Fallback to contentSourceId meta when site was renamed and meta lives in source folder
  let categories = categoriesRaw;
  if (categories.length === 0 && config.contentSourceId) {
    categories = await getCategories(env.CONTENT_BUCKET, config.contentSourceId);
  }

  const category = findCategory(categories, slug);
  // Use category slug for D1 query (posts store slug, not name); fallback to URL slug
  const filterSlug = category?.slug ?? slug;

  // Load posts from D1
  const categoryPrefix = config.routes?.category || 'category';
  const baseUrl = `/${categoryPrefix}/${slug}`;
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage, { category: filterSlug }
  );

  if (total === 0 && !category && !isUncategorized(slug)) return null;

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);
  const pagination = buildPagination(total, page, config.postsPerPage, baseUrl);

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const listTitle = isUncategorized(slug) ? labels.uncategorized : (category?.name || slug);
  const marketDirectoryLinks = buildMarketDirectoryEntries(config, categories)
    .filter((entry) => entry.slug !== filterSlug);
  const supportDirectoryLinks = buildSupportDirectoryEntries(config, categories, [filterSlug]);
  const breadcrumbs = [
    { name: config.name, url: '/' },
    { name: config.blog?.title || labels.blog, url: `/${config.routes?.blog || 'blog'}` },
    { name: listTitle, url: baseUrl },
  ];

  const postsWithAuthor = enrichPostsWithAuthorIdentity(posts, authors, env.SITE_ID);
  const postsWithAuthorAndCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    postsWithAuthor,
    categories,
    labels.uncategorized,
  );

  const basePath = page === 1
    ? `/${categoryPrefix}/${slug}`
    : `/${categoryPrefix}/${slug}/page/${page}`;
  const seo = buildListSeo(config, basePath, page, pagination, env.EFFECTIVE_ORIGIN);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const defaultImages = config.defaults || {};

  // Resolve featured image: category meta > default category image
  const listFeaturedImage = category?.featuredImage || defaultImages.category || '';

  // Use category featured image as OG image if available
  if (listFeaturedImage) seo.ogImage = listFeaturedImage;

  const html = render(config.theme || 'default', 'category', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: listTitle,
    pageDescription: category?.description,
    seo,
    schema: {
      website: buildWebSiteSchema(config, base),
      breadcrumbList: buildBreadcrumbSchema(config, breadcrumbs, base),
    },
    showHeader: true,
    showFooter: true,
    customPartials,
    breadcrumbs,
    listTitle,
    listDescription: category?.description || '',
    listFeaturedImage,
    directoryLabel: config.language?.startsWith('zh') ? '继续浏览' : 'Keep browsing',
    directorySummary: config.language?.startsWith('zh')
      ? '继续沿市场主线或常青研究栏目扩展阅读，避免只停留在单一分类页。'
      : 'Continue through adjacent market tracks and evergreen research sections instead of stopping at a single category page.',
    marketDirectoryLinks,
    supportDirectoryLinks,
    archiveHref: `/${config.routes?.blog || 'blog'}`,
    archiveLabel: config.language?.startsWith('zh') ? '查看全部归档' : 'Browse the full archive',
    postsLayout: config.blog?.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
