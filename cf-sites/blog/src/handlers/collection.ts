
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCollections, getAuthors, getCategories } from '../services/meta.js';
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

export async function handleCollection(env: Env, key: string, page: number): Promise<Response | null> {
  const [config, collections, authors, categories, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getCollections(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  const collection = collections.find((c) => c.key === key);

  // Use route mapping for blog collection, fallback to legacy /collections/:key
  const blogPrefix = config.routes?.blog || 'blog';
  const baseUrl = key === 'blog' ? `/${blogPrefix}` : `/collections/${key}`;

  // Load posts from D1
  const filter = key === 'blog' ? undefined : { collection: key };
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage, filter
  );

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
    ? baseUrl
    : `${baseUrl}/page/${page}`;
  const seo = buildListSeo(config, basePath, page, pagination, env.EFFECTIVE_ORIGIN);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);

  // Blog config overrides for the 'blog' collection
  const blogConfig = config.blog || {};
  const defaultImages = config.defaults || {};
  const isBlog = key === 'blog';

  // Resolve title/description/coverImage with priority: blogConfig > collection meta > i18n blog label
  const listTitle = isBlog
    ? (blogConfig.title || collection?.name || labels.blog)
    : (collection?.name || key);
  const listDescription = isBlog
    ? (blogConfig.description || collection?.description || '')
    : (collection?.description || '');
  const listCoverImage = isBlog
    ? (blogConfig.coverImage || collection?.coverImage || defaultImages.collection || '')
    : (collection?.coverImage || defaultImages.collection || '');

  // Use cover image as OG image if available
  if (listCoverImage) seo.ogImage = listCoverImage;

  const html = render(config.theme || 'default', 'collection', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: listTitle,
    pageDescription: listDescription,
    seo,
    schema: { website: buildWebSiteSchema(config, base) },
    showHeader: true,
    showFooter: true,
    customPartials,
    listTitle,
    listDescription,
    listCoverImage,
    postsLayout: blogConfig.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
