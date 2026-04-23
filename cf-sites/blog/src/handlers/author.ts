
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getAuthors, getCategories } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';

import {
  buildListSeo,
  buildWebSiteSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { enrichPostsWithCategoryDisplayNames } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

export async function handleAuthor(env: Env, id: string, page: number): Promise<Response | null> {
  const [config, authors, categories, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
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

  const basePath = page === 1
    ? `/${authorPrefix}/${id}`
    : `/${authorPrefix}/${id}/page/${page}`;
  const seo = buildListSeo(config, basePath, page, pagination, env.EFFECTIVE_ORIGIN);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);

  const html = render(config.theme || 'default', 'author', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: author?.name || id,
    pageDescription: author?.bio,
    seo,
    schema: { website: buildWebSiteSchema(config, base) },
    showHeader: true,
    showFooter: true,
    customPartials,
    author: author || { id, name: id, count: total },
    posts: postsWithCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
