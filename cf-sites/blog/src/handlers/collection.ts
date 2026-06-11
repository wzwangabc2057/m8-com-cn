
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCollections, getAuthors, getCategories } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';
import { enrichPostsWithAuthorIdentity } from '../utils/authors.js';
import { buildMarketDirectoryEntries, buildSupportDirectoryEntries } from '../utils/category-directory.js';

import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildCollectionSeoMeta,
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

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const postsWithAuthor = enrichPostsWithAuthorIdentity(posts, authors, env.SITE_ID);
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
    ? (blogConfig.description || collection?.description || config.description)
    : (collection?.description || '');
  const listCoverImage = isBlog
    ? (blogConfig.coverImage || collection?.coverImage || defaultImages.collection || '')
    : (collection?.coverImage || defaultImages.collection || '');
  const seoMeta = buildCollectionSeoMeta(config, key, listTitle, listDescription, isBlog);
  const directoryCategories = isBlog
    ? buildMarketDirectoryEntries(config, categories)
    : [];
  const directoryLinks = isBlog
    ? buildSupportDirectoryEntries(config, categories, directoryCategories.map((item) => item.slug))
    : [];
  const breadcrumbs = [
    { name: config.name, url: '/' },
    { name: listTitle, url: baseUrl },
  ];

  // Use cover image as OG image if available
  if (listCoverImage) seo.ogImage = listCoverImage;

  const html = render(config.theme || 'default', 'collection', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: seoMeta.title,
    pageDescription: seoMeta.description,
    seo,
    schema: {
      website: buildWebSiteSchema(config, base),
      breadcrumbList: buildBreadcrumbSchema(config, breadcrumbs, base),
      collectionPage: buildCollectionPageSchema(config, listTitle, seoMeta.description, basePath, postsWithAuthorAndCategoryDisplay, base),
    },
    showHeader: true,
    showFooter: true,
    customPartials,
    listTitle,
    listDescription: seoMeta.description,
    listCoverImage,
    breadcrumbs,
    directoryLabel: config.language?.startsWith('zh') ? '研究目录' : 'Research directory',
    directoryTitle: config.language?.startsWith('zh') ? '先按市场主线，再进入延伸栏目' : 'Start with market tracks, then branch into deeper research lanes',
    directorySummary: config.language?.startsWith('zh')
      ? '先从 A股、美股、港股、区块链四个主入口切入，再继续到 AI 产业链、行业研究、宏观与投资框架。'
      : 'Start from the four main market entrances, then continue into AI, industry research, macro, and investing frameworks.',
    directoryCategories,
    directoryLinks,
    postsLayout: blogConfig.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: postsWithAuthorAndCategoryDisplay,
    pagination,
  });

  return htmlResponse(html);
}
