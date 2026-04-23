
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getTags, getAuthors, getCategories } from '../services/meta.js';
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

  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const postsWithAuthor = posts.map((p) => ({
    ...p,
    authorDisplayName: authorMap.get(p.author)?.name || p.author,
  }));
  const postsWithAuthorAndCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    postsWithAuthor,
    categories,
    labels.uncategorized,
  );

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
    pageDescription: tag?.description,
    seo,
    schema: { website: buildWebSiteSchema(config, base) },
    showHeader: true,
    showFooter: true,
    customPartials,
    listTitle: tag?.name || slug,
    listFeaturedImage,
    postsLayout: config.blog?.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
