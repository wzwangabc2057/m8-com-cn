import type { SiteConfig, Post, PostSummary, Author, SeoMeta, PageEntry, RouteMapping } from '../types.js';

/** Strip HTML tags and entities from a string for clean meta content */
export function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build the URL path for a post, respecting the post prefix.
 * When prefix is '' (empty), returns /{slug}. Otherwise /{prefix}/{slug}.
 */
export function buildPostPath(routes: RouteMapping | undefined, slug: string): string {
  const postPrefix = routes?.post ?? 'blog';
  return postPrefix === '' ? `/${slug}` : `/${postPrefix}/${slug}`;
}

/**
 * Build canonical URL from site URL and path
 * Trailing slash rules (matching redirect behavior):
 * - Root path '/' → keeps trailing slash: https://example.com/
 * - All other paths → no trailing slash: https://example.com/blog
 */
export function buildCanonicalUrl(siteUrl: string, path: string): string {
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Root path keeps trailing slash (matches actual browser URL)
  if (cleanPath === '/') {
    return `${cleanSiteUrl}/`;
  }
  
  // Remove trailing slash for all other paths
  cleanPath = cleanPath.replace(/\/+$/, '');
  
  return `${cleanSiteUrl}${cleanPath}`;
}

/** Base URL for canonical (origin, no trailing slash). Prefers request effective origin over config.url. */
export function getCanonicalBase(config: SiteConfig, effectiveOrigin?: string): string {
  const base = effectiveOrigin || (config as { url?: string }).url || '';
  return base.replace(/\/$/, '');
}

/** Normalize a full URL to our trailing-slash rule; use when canonical comes from CMS/WP */
export function normalizeCanonicalUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '') return `${u.origin}/`;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Build SEO metadata for a post
 */
export function buildPostSeo(
  config: SiteConfig,
  post: Post,
  authorObj?: Author,
  categorySlug?: string,
  effectiveOrigin?: string,
): SeoMeta {
  const base = getCanonicalBase(config, effectiveOrigin);
  const path = buildPostPath(config.routes, post.slug);
  const raw = effectiveOrigin
    ? buildCanonicalUrl(base, path)
    : (post.seo?.canonical || buildCanonicalUrl(base, path));
  const canonicalUrl = normalizeCanonicalUrl(raw);

  return {
    canonicalUrl,
    ogType: 'article',
    ogImage: post.seo?.ogImage || post.coverImage || config.seo?.defaultOgImage,
    articlePublishedTime: post.publishedAt,
    articleModifiedTime: post.updatedAt,
    articleAuthor: authorObj?.name || post.author,
    articleTags: post.tags,
    articleSection: categorySlug || (post.categories.length > 0 ? post.categories[0] : undefined),
    noindex: post.seo?.noindex,
  };
}

/**
 * Build SEO metadata for homepage
 */
export function buildHomeSeo(config: SiteConfig, effectiveOrigin?: string): SeoMeta {
  const base = getCanonicalBase(config, effectiveOrigin);
  return {
    canonicalUrl: buildCanonicalUrl(base, '/'),
    ogType: 'website',
    ogImage: config.seo?.defaultOgImage,
  };
}

/**
 * Build SEO metadata for a page
 */
export function buildPageSeo(config: SiteConfig, pageEntry: PageEntry, slug: string, effectiveOrigin?: string): SeoMeta {
  const base = getCanonicalBase(config, effectiveOrigin);
  const path = slug === '' ? '/' : `/${slug}`;
  const canonicalUrl = buildCanonicalUrl(base, path);
  return {
    canonicalUrl,
    ogType: 'website',
    ogImage: pageEntry.featuredImage || config.seo?.defaultOgImage,
    noindex: pageEntry.noindex === true,
  };
}

/**
 * Build SEO metadata for list pages (category, tag, author, collection)
 */
export function buildListSeo(
  config: SiteConfig,
  path: string,
  page: number,
  pagination?: { hasPrev: boolean; hasNext: boolean; prevUrl: string | null; nextUrl: string | null },
  effectiveOrigin?: string,
): SeoMeta {
  const base = getCanonicalBase(config, effectiveOrigin);
  const canonicalUrl = buildCanonicalUrl(base, path);
  const seo: SeoMeta = {
    canonicalUrl,
    ogType: 'website',
    ogImage: config.seo?.defaultOgImage,
    // Noindex paginated pages (page > 1) to avoid duplicate content
    noindex: page > 1,
  };
  
  // Add rel prev/next for paginated pages
  if (pagination) {
    if (pagination.hasPrev && pagination.prevUrl) {
      seo.prevUrl = buildCanonicalUrl(base, pagination.prevUrl);
    }
    if (pagination.hasNext && pagination.nextUrl) {
      seo.nextUrl = buildCanonicalUrl(base, pagination.nextUrl);
    }
  }
  
  return seo;
}

function isZhLanguage(language?: string): boolean {
  return (language || '').toLowerCase().startsWith('zh');
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildZhCategoryTitle(name: string): string {
  const cleanName = stripHtml(name || '').trim();
  if (!cleanName) return '栏目研究与分析';
  if (/(研究|分析|深度|观察|专题|复盘|追踪)$/.test(cleanName)) return cleanName;
  return `${cleanName}研究与分析`;
}

const ZH_CATEGORY_SEO: Record<string, { title: string; description: string }> = {
  'ai-stocks': {
    title: 'AI产业链研究与AI算力主线',
    description: '聚合 AI 算力、HBM、先进封装、数据中心电力、光模块与人形机器人研究，覆盖 AI 产业链最核心的公司与主题路径。',
  },
  'us-stocks': {
    title: '美股研究与美股个股分析',
    description: '聚合美股个股深度、科技龙头财报、AI 产业链、估值框架与交易主线，持续更新美股核心公司与主题研究。',
  },
  'a-stocks': {
    title: 'A股研究与A股公司深度',
    description: '聚合 A 股公司研究、行业景气、政策催化、国产替代与高股息主线，帮助快速定位 A 股核心机会与风险。',
  },
  'hk-stocks': {
    title: '港股研究与港股高股息',
    description: '聚合港股互联网、港股高股息、南向资金、创新药与估值比较，覆盖港股核心公司、行业与主题机会。',
  },
  crypto: {
    title: '加密货币与比特币研究',
    description: '聚合比特币、以太坊、稳定币、ETF 资金流、链上生态与加密监管观察，覆盖加密市场核心主题。',
  },
  macro: {
    title: '宏观市场与利率观察',
    description: '聚合美联储、非农、通胀、美元、美债、汇率与全球资产定价观察，帮助理解跨市场资金与风险偏好变化。',
  },
  'industry-research': {
    title: '行业深度研究与产业链分析',
    description: '聚合 AI 产业链、半导体、创新药、机器人、新能源与周期行业研究，覆盖景气、竞争格局与估值参照系。',
  },
  'investing-101': {
    title: '投资入门与投资框架',
    description: '聚合估值、仓位管理、回撤控制、因子模型、资产配置与常见投资概念，适合构建系统化投资框架。',
  },
};

export function buildCategorySeoMeta(
  config: SiteConfig,
  slug: string,
  name: string,
  description?: string,
): { title: string; description: string } {
  const cleanName = stripHtml(name || humanizeSlug(slug) || 'Category');
  const cleanDescription = stripHtml(description || '');

  if (isZhLanguage(config.language)) {
    const preset = ZH_CATEGORY_SEO[slug];
    if (preset) {
      return {
        title: preset.title,
        description: cleanDescription || preset.description,
      };
    }
    if (cleanDescription) {
      return {
        title: buildZhCategoryTitle(cleanName),
        description: cleanDescription,
      };
    }
    return {
      title: buildZhCategoryTitle(cleanName),
      description: `${config.name}${cleanName ? ` ${cleanName}` : ''}栏目，持续更新${cleanName}相关的最新文章、主题研究、公司分析与投资框架。`,
    };
  }

  if (cleanDescription) {
    return {
      title: `${cleanName} Research and Analysis`,
      description: cleanDescription,
    };
  }

  return {
    title: `${cleanName} Research and Analysis`,
    description: `${config.name} ${cleanName} section with the latest articles, research notes, company analysis, and investing frameworks.`,
  };
}

export function buildCollectionSeoMeta(
  config: SiteConfig,
  key: string,
  name: string,
  description?: string,
  isBlog = false,
): { title: string; description: string } {
  const cleanName = stripHtml(name || humanizeSlug(key) || 'Collection');
  const cleanDescription = stripHtml(description || '');
  if (cleanDescription) {
    return {
      title: isBlog
        ? cleanName
        : (isZhLanguage(config.language) ? `${cleanName}专题与文章汇总` : `${cleanName} Collection`),
      description: cleanDescription,
    };
  }

  if (isZhLanguage(config.language)) {
    if (isBlog) {
      return {
        title: '最新文章与市场研究',
        description: `${config.name}最新文章列表，覆盖${stripHtml(config.description || '市场研究与公司分析')}，持续更新市场观察、公司深度与投资框架。`,
      };
    }
    return {
      title: `${cleanName}专题与文章汇总`,
      description: `${config.name}${cleanName ? ` ${cleanName}` : ''}专题页，汇总相关文章、研究更新与延伸阅读，方便按主题连续浏览。`,
    };
  }

  if (isBlog) {
    return {
      title: 'Latest Posts and Market Research',
      description: `${config.name} latest posts page covering ${stripHtml(config.description || 'market research and company analysis')}.`,
    };
  }

  return {
    title: `${cleanName} Collection`,
    description: `${config.name} ${cleanName} collection page with the latest posts, research updates, and related reading.`,
  };
}

/**
 * Build JSON-LD WebSite schema. baseUrl should be from getCanonicalBase(config, effectiveOrigin).
 */
export function buildWebSiteSchema(config: SiteConfig, baseUrl: string): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: baseUrl,
    description: config.description,
    inLanguage: config.language,
  };

  if (config.seo?.searchUrlTemplate) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: config.seo.searchUrlTemplate,
      },
      'query-input': 'required name=search_term_string',
    };
  }

  return schema;
}

/**
 * Build JSON-LD BlogPosting schema. baseUrl from getCanonicalBase(config, effectiveOrigin).
 */
export function buildBlogPostingSchema(
  config: SiteConfig,
  post: Post,
  authorObj?: Author,
  baseUrl?: string,
): Record<string, unknown> {
  const base = baseUrl ?? '';
  const postUrl = buildCanonicalUrl(base, buildPostPath(config.routes, post.slug));

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: config.name,
      url: base,
    },
  };

  if (post.coverImage) {
    schema.image = {
      '@type': 'ImageObject',
      url: post.coverImage.startsWith('http') ? post.coverImage : buildCanonicalUrl(base, post.coverImage),
    };
  }

  if (authorObj) {
    schema.author = {
      '@type': 'Person',
      name: authorObj.name,
      ...(authorObj.url && { url: authorObj.url }),
    };
  } else {
    schema.author = {
      '@type': 'Person',
      name: post.author,
    };
  }

  if (post.categories?.length > 0) {
    schema.articleSection = post.categories[0];
  }

  if (post.tags?.length > 0) {
    schema.keywords = post.tags.join(', ');
  }

  return schema;
}

/**
 * Build JSON-LD Organization schema. baseUrl from getCanonicalBase(config, effectiveOrigin).
 */
export function buildOrganizationSchema(config: SiteConfig, baseUrl: string): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: baseUrl,
    description: config.description,
  };

  if (config.social && config.social.length > 0) {
    schema.sameAs = config.social.map((s) => s.url);
  }

  return schema;
}

/**
 * Build JSON-LD BreadcrumbList schema. baseUrl from getCanonicalBase(config, effectiveOrigin).
 */
export function buildBreadcrumbSchema(
  config: SiteConfig,
  items: Array<{ name: string; url: string }>,
  baseUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(baseUrl, item.url),
    })),
  };
}

export function buildCollectionPageSchema(
  config: SiteConfig,
  title: string,
  description: string,
  path: string,
  posts: Array<Pick<PostSummary, 'slug' | 'title'>>,
  baseUrl: string,
): Record<string, unknown> {
  const canonicalUrl = buildCanonicalUrl(baseUrl, path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: config.name,
      url: baseUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: buildCanonicalUrl(baseUrl, buildPostPath(config.routes, post.slug)),
      })),
    },
  };
}
