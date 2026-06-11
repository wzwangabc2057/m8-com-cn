
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getTags, getAuthors, getCategories } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';
import { enrichPostsWithAuthorIdentity } from '../utils/authors.js';
import { buildMarketDirectoryEntries, buildSupportDirectoryEntries } from '../utils/category-directory.js';
import { buildCategoryLinksFromPosts } from '../utils/taxonomy-nav.js';

import {
  buildBreadcrumbSchema,
  buildListSeo,
  buildWebSiteSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { enrichPostsWithCategoryDisplayNames } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

export async function handleTag(env: Env, slug: string, page: number): Promise<Response | null> {
  const [config, tags, authors, categories, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getTags(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  const tag = tags.find((t) => t.slug === slug);

  // Load posts from D1
  const tagPrefix = config.routes?.tag || 'tag';
  const baseUrl = `/${tagPrefix}/${slug}`;
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage, { tag: slug }
  );

  if (total === 0 && !tag) return null;

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);
  const pagination = buildPagination(total, page, config.postsPerPage, baseUrl);

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const postsWithAuthor = enrichPostsWithAuthorIdentity(posts, authors, env.SITE_ID);
  const postsWithAuthorAndCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    postsWithAuthor,
    categories,
    labels.uncategorized,
  );
  const relatedCategories = buildCategoryLinksFromPosts(config, categories, postsWithAuthorAndCategoryDisplay, 6);
  const marketDirectoryLinks = buildMarketDirectoryEntries(config, categories)
    .filter((entry) => !relatedCategories.some((item) => item.slug === entry.slug));
  const supportDirectoryLinks = buildSupportDirectoryEntries(
    config,
    categories,
    [...relatedCategories, ...marketDirectoryLinks].map((item) => item.slug),
  );
  const isZh = (config.language || '').toLowerCase().startsWith('zh');
  const derivedDescription = tag?.description
    || (relatedCategories.length > 0
      ? `${tag?.name || slug} 相关内容主要落在 ${relatedCategories.map((item) => item.name).slice(0, 3).join('、')}，便于顺着标签继续回到主栏目和专题阅读。`
      : `聚合 ${tag?.name || slug} 相关研究、快评与主题文章，方便从标签回到栏目主线。`);
  const breadcrumbs = [
    { name: config.name, url: '/' },
    { name: config.blog?.title || labels.blog, url: `/${config.routes?.blog || 'blog'}` },
    { name: `#${tag?.name || slug}`, url: baseUrl },
  ];

  const basePath = page === 1
    ? `/${tagPrefix}/${slug}`
    : `/${tagPrefix}/${slug}/page/${page}`;
  const seo = buildListSeo(config, basePath, page, pagination, env.EFFECTIVE_ORIGIN);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const defaultImages = config.defaults || {};

  // Resolve featured image: tag meta > default tag image
  const listFeaturedImage = tag?.featuredImage || defaultImages.tag || '';

  // Use tag featured image as OG image if available
  if (listFeaturedImage) seo.ogImage = listFeaturedImage;

  const html = render(config.theme || 'default', 'tag', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: tag?.name || slug,
    pageDescription: derivedDescription,
    seo,
    schema: {
      website: buildWebSiteSchema(config, base),
      breadcrumbList: buildBreadcrumbSchema(config, breadcrumbs, base),
    },
    showHeader: true,
    showFooter: true,
    customPartials,
    breadcrumbs,
    listTitle: tag?.name || slug,
    listDescription: derivedDescription,
    listFeaturedImage,
    relatedCategories,
    marketDirectoryLinks,
    supportDirectoryLinks,
    archiveHref: `/${config.routes?.blog || 'blog'}`,
    archiveLabel: isZh ? '查看全部归档' : 'Browse the full archive',
    directoryLabel: isZh ? '标签导航' : 'Tag navigation',
    directorySummary: isZh
      ? '先看这个标签覆盖在哪些栏目，再回到对应市场和研究主线。'
      : 'See which sections this tag belongs to, then return to the core market and research tracks.',
    postsLayout: config.blog?.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
