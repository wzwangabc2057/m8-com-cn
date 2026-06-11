
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getAuthors, getCategories, getTags } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';
import { buildMarketDirectoryEntries, buildSupportDirectoryEntries } from '../utils/category-directory.js';
import { buildCategoryLinksFromPosts, buildTagLinksFromPosts } from '../utils/taxonomy-nav.js';

import {
  buildBreadcrumbSchema,
  buildListSeo,
  buildWebSiteSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { enrichPostsWithCategoryDisplayNames } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

export async function handleAuthor(env: Env, id: string, page: number): Promise<Response | null> {
  const [config, authors, categories, tags, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getTags(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  const author = authors.find((a) => a.id === id);

  // Load posts from D1
  const authorPrefix = config.routes?.author || 'author';
  const baseUrl = `/${authorPrefix}/${id}`;
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage, { author: id }
  );

  if (total === 0 && !author) return null;

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);
  const pagination = buildPagination(total, page, config.postsPerPage, baseUrl);

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const postsWithCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    posts,
    categories,
    labels.uncategorized,
  );
  const focusCategories = buildCategoryLinksFromPosts(config, categories, postsWithCategoryDisplay, 6);
  const focusTags = buildTagLinksFromPosts(config, tags, postsWithCategoryDisplay, 8);
  const marketDirectoryLinks = buildMarketDirectoryEntries(config, categories)
    .filter((entry) => !focusCategories.some((item) => item.slug === entry.slug));
  const supportDirectoryLinks = buildSupportDirectoryEntries(
    config,
    categories,
    [...focusCategories, ...marketDirectoryLinks].map((item) => item.slug),
  );
  const isZh = (config.language || '').toLowerCase().startsWith('zh');
  const derivedDescription = author?.bio
    || (focusCategories.length > 0
      ? `${author?.name || id} 主要覆盖 ${focusCategories.map((item) => item.name).slice(0, 3).join('、')} 等主线内容。`
      : `${author?.name || id} 的研究与文章归档。`);
  const breadcrumbs = [
    { name: config.name, url: '/' },
    { name: config.blog?.title || labels.blog, url: `/${config.routes?.blog || 'blog'}` },
    { name: author?.name || id, url: baseUrl },
  ];

  const basePath = page === 1
    ? `/${authorPrefix}/${id}`
    : `/${authorPrefix}/${id}/page/${page}`;
  const seo = buildListSeo(config, basePath, page, pagination, env.EFFECTIVE_ORIGIN);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);

  const html = render(config.theme || 'default', 'author', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: author?.name || id,
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
    author: author || { id, name: id, count: total, bio: derivedDescription },
    authorDescription: derivedDescription,
    authorPostCountLabel: isZh ? `${total} 篇文章` : `${total} posts`,
    focusCategories,
    focusTags,
    marketDirectoryLinks,
    supportDirectoryLinks,
    archiveHref: `/${config.routes?.blog || 'blog'}`,
    archiveLabel: isZh ? '查看全部归档' : 'Browse the full archive',
    posts: postsWithCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
