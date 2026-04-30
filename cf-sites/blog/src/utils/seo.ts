import type { SiteConfig, Post, Author, SeoMeta, PageEntry, RouteMapping } from '../types.js';

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

/**
 * Build JSON-LD WebSite schema. baseUrl should be from getCanonicalBase(config, effectiveOrigin).
 */
export function buildWebSiteSchema(config: SiteConfig, baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: baseUrl,
    description: config.description,
    inLanguage: config.language,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
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
