
import { getConfig, getPageRegistry } from '../services/content.js';
import { getCategories, getTags, getAuthors } from '../services/meta.js';
import { buildCanonicalUrl, buildPostPath, getCanonicalBase } from '../utils/seo.js';
import type { Env, SiteConfig } from '../types.js';


/** Max URLs per sitemap file (Google limit is 50,000) */
const MAX_URLS_PER_SITEMAP = 5000;

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

interface SitemapPostRow {
  slug: string;
  publishedAt?: string;
}

interface SitemapStrategy {
  includePages: boolean;
  includeTaxonomies: boolean;
  maxPosts?: number;
  excludeCategories: string[];
}

/**
 * Handle all sitemap-related routes:
 * - /sitemap.xml            → Flat Sitemap Index (sitemap-posts-1.xml, ..., sitemap-pages.xml, sitemap-taxonomies.xml)
 * - /sitemap-posts.xml      → Legacy alias of /sitemap.xml (kept for old GSC submissions)
 * - /sitemap-posts-N.xml    → Posts URLs (paginated)
 * - /sitemap-pages.xml      → Static pages
 * - /sitemap-taxonomies.xml → Categories, tags, authors, blog list
 */
export async function handleSitemap(env: Env, pathname: string): Promise<Response | null> {
  if (pathname === '/sitemap.xml') {
    return generateSitemapIndex(env);
  }

  // Legacy alias: older Search Console submissions may still point here.
  // Serve the same sitemap index instead of redirecting so Google can refresh
  // the submitted URL without depending on redirect bookkeeping.
  if (pathname === '/sitemap-posts.xml') {
    return generateSitemapIndex(env);
  }

  const postsMatch = pathname.match(/^\/sitemap-posts-(\d+)\.xml$/);
  if (postsMatch) {
    const page = parseInt(postsMatch[1], 10);
    return generatePostsSitemap(env, page);
  }

  if (pathname === '/sitemap-pages.xml') {
    return generatePagesSitemap(env);
  }

  if (pathname === '/sitemap-taxonomies.xml') {
    return generateTaxonomiesSitemap(env);
  }

  return null;
}

// ─── Sitemap Index ──────────────────────────────────────────

async function generateSitemapIndex(env: Env): Promise<Response> {
  const [config, pages] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getPageRegistry(env.CONTENT_BUCKET, env.SITE_ID, env.DB),
  ]);

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const strategy = getSitemapStrategy(config, env.SITE_ID);
  const sitemaps: Array<{ loc: string; lastmod?: string }> = [];

  // Paginated post sitemaps directly (flat — no nested sitemapindex)
  const [totalPosts, latestPost] = await Promise.all([
    countSitemapPosts(env.DB, env.SITE_ID, strategy),
    getSitemapPosts(env.DB, env.SITE_ID, 1, 0, strategy),
  ]);
  const postPages = Math.max(1, Math.ceil(totalPosts / MAX_URLS_PER_SITEMAP));
  const lastmod = latestPost.length > 0 && latestPost[0].publishedAt
    ? new Date(latestPost[0].publishedAt).toISOString().split('T')[0]
    : undefined;
  for (let i = 1; i <= postPages; i++) {
    sitemaps.push({
      loc: buildCanonicalUrl(base, `/sitemap-posts-${i}.xml`),
      lastmod,
    });
  }

  // Pages sitemap
  const pageEntries = Object.entries(pages).filter(
    ([slug, meta]) => slug !== 'index' && !meta.noindex,
  );
  if (strategy.includePages && pageEntries.length > 0) {
    sitemaps.push({
      loc: buildCanonicalUrl(base, '/sitemap-pages.xml'),
    });
  }

  // Taxonomies sitemap
  if (strategy.includeTaxonomies) {
    sitemaps.push({
      loc: buildCanonicalUrl(base, '/sitemap-taxonomies.xml'),
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map((s) => {
  let inner = `    <loc>${escapeXml(s.loc)}</loc>`;
  if (s.lastmod) inner += `\n    <lastmod>${escapeXml(s.lastmod)}</lastmod>`;
  return `  <sitemap>\n${inner}\n  </sitemap>`;
}).join('\n')}
</sitemapindex>`;

  return xmlResponse(xml);
}

// ─── Posts Sitemap (sitemap-posts-N.xml) ─────────────────────

async function generatePostsSitemap(env: Env, page: number): Promise<Response> {
  const config = await getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE);
  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const strategy = getSitemapStrategy(config, env.SITE_ID);
  
  // Get posts for this page of sitemap
  const posts = await getSitemapPosts(
    env.DB,
    env.SITE_ID,
    MAX_URLS_PER_SITEMAP,
    (page - 1) * MAX_URLS_PER_SITEMAP,
    strategy,
  );

  const urls: SitemapUrl[] = [];

  // Page 1 includes homepage and blog list
  if (page === 1) {
    urls.push({
      loc: buildCanonicalUrl(base, '/'),
      changefreq: 'daily',
      priority: '1.0',
    });
    const blogPrefix = config.routes?.blog || 'blog';
    if (blogPrefix) {
      urls.push({
        loc: buildCanonicalUrl(base, `/${blogPrefix}`),
        changefreq: 'daily',
        priority: '0.9',
      });
    }
  }

  for (const post of posts) {
    if (!post.slug) continue;
    const lastmod = post.publishedAt
      ? new Date(post.publishedAt).toISOString().split('T')[0]
      : undefined;
    urls.push({
      loc: buildCanonicalUrl(base, buildPostPath(config.routes, post.slug)),
      lastmod,
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  return xmlResponse(buildUrlsetXml(urls));
}

// ─── Pages Sitemap ──────────────────────────────────────────

async function generatePagesSitemap(env: Env): Promise<Response> {
  const [config, pages] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getPageRegistry(env.CONTENT_BUCKET, env.SITE_ID, env.DB),
  ]);

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const urls: SitemapUrl[] = [];
  for (const [slug, pageMeta] of Object.entries(pages)) {
    if (slug === 'index') continue;
    if (pageMeta.noindex) continue;
    urls.push({
      loc: buildCanonicalUrl(base, `/${slug}`),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  // 无页面时返回 404，避免空 sitemap 被索引且与根 sitemap 一致（根索引里本就不含 sitemap-pages）
  if (urls.length === 0) {
    return new Response(null, { status: 404 });
  }

  return xmlResponse(buildUrlsetXml(urls));
}

// ─── Taxonomies Sitemap ─────────────────────────────────────

async function generateTaxonomiesSitemap(env: Env): Promise<Response> {
  const [config, categories, tags, authors] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getTags(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
  ]);

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const urls: SitemapUrl[] = [];

  const categoryPrefix = config.routes?.category || 'category';
  for (const category of categories) {
    urls.push({
      loc: buildCanonicalUrl(base, `/${categoryPrefix}/${category.slug}`),
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  const tagPrefix = config.routes?.tag || 'tag';
  for (const tag of tags) {
    urls.push({
      loc: buildCanonicalUrl(base, `/${tagPrefix}/${tag.slug}`),
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  const authorPrefix = config.routes?.author || 'author';
  for (const author of authors) {
    urls.push({
      loc: buildCanonicalUrl(base, `/${authorPrefix}/${author.id}`),
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  return xmlResponse(buildUrlsetXml(urls));
}

// ─── Helpers ────────────────────────────────────────────────

function buildUrlsetXml(urls: SitemapUrl[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => {
  let inner = `    <loc>${escapeXml(url.loc)}</loc>`;
  if (url.lastmod) inner += `\n    <lastmod>${escapeXml(url.lastmod)}</lastmod>`;
  inner += `\n    <changefreq>${escapeXml(url.changefreq)}</changefreq>`;
  inner += `\n    <priority>${escapeXml(url.priority)}</priority>`;
  return `  <url>\n${inner}\n  </url>`;
}).join('\n')}
</urlset>`;
}

function getSitemapStrategy(config: SiteConfig, siteId: string): SitemapStrategy {
  const configured = config.seo?.sitemap;
  if (configured) {
    return {
      includePages: configured.includePages !== false,
      includeTaxonomies: configured.includeTaxonomies !== false,
      maxPosts: configured.maxPosts,
      excludeCategories: configured.excludeCategories || [],
    };
  }

  // New domains benefit from a tighter crawl surface. m8 is still in this phase,
  // so default to a smaller, post-first sitemap until site-level settings override it.
  if (siteId === 'm8.com.cn') {
    return {
      includePages: true,
      includeTaxonomies: false,
      maxPosts: 120,
      excludeCategories: ['investing-101'],
    };
  }

  return {
    includePages: true,
    includeTaxonomies: true,
    excludeCategories: [],
  };
}

function buildExcludedCategoryClause(strategy: SitemapStrategy): { clause: string; params: string[] } {
  if (strategy.excludeCategories.length === 0) {
    return { clause: '', params: [] };
  }

  const placeholders = strategy.excludeCategories.map(() => '?').join(', ');
  return {
    clause: `
      AND NOT EXISTS (
        SELECT 1
        FROM post_taxonomies t
        WHERE t.siteId = p.siteId
          AND t.postSlug = p.slug
          AND t.type = 'category'
          AND t.value IN (${placeholders})
      )
    `,
    params: strategy.excludeCategories,
  };
}

async function countSitemapPosts(
  db: D1Database,
  siteId: string,
  strategy: SitemapStrategy,
): Promise<number> {
  const excluded = buildExcludedCategoryClause(strategy);
  const result = await db.prepare(`
      SELECT COUNT(*) as total
      FROM posts p
      WHERE p.siteId = ?
        AND p.type = 'post'
        AND p.status = 'published'
        ${excluded.clause}
    `)
    .bind(siteId, ...excluded.params)
    .first<{ total: number }>();

  const total = result?.total || 0;
  return typeof strategy.maxPosts === 'number' ? Math.min(total, strategy.maxPosts) : total;
}

async function getSitemapPosts(
  db: D1Database,
  siteId: string,
  limit: number,
  offset: number,
  strategy: SitemapStrategy,
): Promise<SitemapPostRow[]> {
  if (typeof strategy.maxPosts === 'number' && offset >= strategy.maxPosts) {
    return [];
  }

  const effectiveLimit = typeof strategy.maxPosts === 'number'
    ? Math.min(limit, Math.max(strategy.maxPosts - offset, 0))
    : limit;
  if (effectiveLimit <= 0) return [];

  const excluded = buildExcludedCategoryClause(strategy);
  const result = await db.prepare(`
      SELECT p.slug, p.publishedAt
      FROM posts p
      WHERE p.siteId = ?
        AND p.type = 'post'
        AND p.status = 'published'
        ${excluded.clause}
      ORDER BY p.publishedAt DESC
      LIMIT ? OFFSET ?
    `)
    .bind(siteId, ...excluded.params, effectiveLimit, offset)
    .all<SitemapPostRow>();

  return result.results || [];
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
