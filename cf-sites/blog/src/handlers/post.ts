import { getConfig, getPost, applyImageResizing } from '../services/content.js';
import { getAuthors, getCategories } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { getPosts } from '../services/d1-content.js';
import { render, htmlResponse } from '../renderer.js';
import {
  buildPostSeo,
  buildPostPath,
  buildWebSiteSchema,
  buildBlogPostingSchema,
  buildBreadcrumbSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { resolveCategoryDisplayName } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

function mergeRelatedPostGroups<T extends { slug: string }>(groups: T[][], currentSlug: string, limit: number): T[] {
  const seen = new Set<string>([currentSlug]);
  const merged: T[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      merged.push(item);
      if (merged.length >= limit) return merged;
    }
  }

  return merged;
}

/**
 * If content is a full HTML document (with <head>/<meta>/<title> etc.),
 * extract just the body content.
 */
function extractBodyContent(content: string): string {
  if (!content) return content;
  let s = content.trim();

  const hasDocMarkers = /<!DOCTYPE\s/i.test(s) || /^<html[\s>]/i.test(s) ||
    (/<head[\s>]/i.test(s) && /<meta\s/i.test(s));
  if (!hasDocMarkers) {
    const startsWithMeta = /^\s*(<meta[\s][^>]*>\s*)+/i.test(s);
    if (!startsWithMeta) return content;
  }

  s = s.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
  s = s.replace(/<html[^>]*>\s*/gi, '').replace(/<\/html>\s*/gi, '');
  s = s.replace(/<head[^>]*>[\s\S]*?<\/head>\s*/gi, '');

  const bodyMatch = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) s = bodyMatch[1].trim();

  s = s.replace(/^(\s*(<meta\s[^>]*>\s*|<title[^>]*>[\s\S]*?<\/title>\s*|<link\s[^>]*>\s*|<!--[\s\S]*?-->\s*))+/gi, '').trim();

  return s;
}

/**
 * Unwrap content that's wrapped in <article class="article-container"> or similar wrappers.
 * AI-generated content often wraps everything in its own article/div/section,
 * which creates nested containers with conflicting width styles.
 */
function unwrapContentContainer(content: string): string {
  if (!content) return content;
  let html = content.trim();

  // Unwrap <article class="article-container">...</article>
  // Also handles <div class="article-container">, <section class="article-...">
  const wrapperMatch = html.match(
    /^\s*<(article|div|section)\s+class\s*=\s*"[^"]*(?:article-container|article-content|post-container|content-wrapper|entry-content)[^"]*"\s*>([\s\S]*)<\/\1>\s*$/i
  );
  if (wrapperMatch) {
    html = wrapperMatch[2].trim();
  }

  // Also unwrap plain <article>...</article> with no meaningful attributes
  const plainArticleMatch = html.match(/^\s*<article(?:\s+[^>]*)?\s*>([\s\S]*)<\/article>\s*$/i);
  if (plainArticleMatch) {
    html = plainArticleMatch[1].trim();
  }

  return html;
}

/**
 * Clean up the beginning of post content:
 * 1. Remove duplicate title lines (common in AI-generated posts)
 * 2. Remove "Oleh: Author" / "By: Author" bylines
 * 3. Remove "site.domain Analysis" / "aiball.world Analisis" watermarks
 */
function cleanContentStart(content: string, title: string): string {
  if (!content || !title) return content;
  let html = content.trim();

  // Decode HTML entities in title for accurate comparison
  const decodedTitle = title
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&[a-z]+;/gi, ' ');
  const normalizedTitle = decodedTitle.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Helper: extract plain text from HTML fragment
  const plainText = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // Helper: check if text is similar to the title (fuzzy match)
  const isTitleLike = (text: string) => {
    const t = text.toLowerCase();
    if (!t || t.length < 5) return false;
    // Exact match
    if (t === normalizedTitle) return true;
    // One contains the other
    if (normalizedTitle.includes(t) || t.includes(normalizedTitle)) return true;
    // Share significant word overlap (>60% of words match)
    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
    const textWords = t.split(/\s+/).filter(w => w.length > 2);
    if (titleWords.length === 0) return false;
    const overlap = titleWords.filter(w => textWords.includes(w)).length;
    return overlap / titleWords.length > 0.5;
  };

  // Remove up to 5 leading elements that are title duplicates, bylines, or watermarks
  for (let i = 0; i < 5; i++) {
    const trimmed = html.trimStart();

    // Match any leading block element: <h1>, <h2>, <p>, <div>
    const blockMatch = trimmed.match(/^<(h[1-6]|p|div)[^>]*>([\s\S]*?)<\/\1>\s*/i);
    if (blockMatch) {
      const text = plainText(blockMatch[2]);

      // Remove if it's a title duplicate
      if (isTitleLike(text)) {
        html = trimmed.slice(blockMatch[0].length).trim();
        continue;
      }

      // Remove "Oleh: Author" / "By: Author" / "Analysis" watermark lines
      if (/^(oleh|by|author|penulis)\s*[:：]/i.test(text)) {
        html = trimmed.slice(blockMatch[0].length).trim();
        continue;
      }

      // Remove "sitename Analysis" / "aiball.world Analisis" watermarks
      if (/aiball\.world\s*(analysis|analisis)/i.test(text) || /\|\s*aiball\.world/i.test(text)) {
        html = trimmed.slice(blockMatch[0].length).trim();
        continue;
      }
    }

    // Match bare text (not in a tag) that looks like a title
    const bareTextMatch = trimmed.match(/^([^<]{10,}?)(?=<)/);
    if (bareTextMatch && isTitleLike(bareTextMatch[1].trim())) {
      html = trimmed.slice(bareTextMatch[0].length).trim();
      continue;
    }

    break;
  }

  return html;
}

export async function handlePost(env: Env, slug: string): Promise<Response | null> {
  const [config, post, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getPost(env.CONTENT_BUCKET, env.SITE_ID, slug, env.CACHE, env.CONTENT_SOURCE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  if (!post) return null;
  // 仅展示已发布；草稿与归档返回 404
  if (post.status && post.status !== 'published') return null;

  // Clean up content: extract body, unwrap wrappers, remove duplicate titles, fix broken image paths
  if (post.content) {
    post.content = extractBodyContent(post.content);
    post.content = unwrapContentContainer(post.content);
    post.content = cleanContentStart(post.content, post.title);
    // Remove broken relative image paths (images/xxx.web, images/xxx.webp) that were
    // not processed by the writing-sync image processor
    post.content = post.content.replace(
      /(<img\s+[^>]*src=["'])images\/[^"']+["'][^>]*>|<img\s+[^>]*src=["']\.\/images\/[^"']+["'][^>]*>/gi,
      ''
    );
    // Downgrade any remaining <h1> to <h2> since the post template provides its own <h1>
    post.content = post.content.replace(/<h1/gi, '<h2').replace(/<\/h1>/gi, '</h2>');
    // Apply CF Image Resizing to content images (src + srcset) when enabled
    post.content = applyImageResizing(post.content, config.imageResizing === true);
  }

  const [authors, categories, customPartials] = await Promise.all([
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID),
  ]);

  // Resolve author: use post.author, fall back to site's first author for posts without one
  let effectiveAuthorId = post.author;
  if (!effectiveAuthorId && authors.length > 0) {
    effectiveAuthorId = authors[0].id;
  }
  const authorObj = authors.find((a) => a.id === effectiveAuthorId);
  const authorName = authorObj?.name || effectiveAuthorId || '';

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  const isZh = (config.language || '').toLowerCase().startsWith('zh');
  const categoryDisplayNames = (post.categories || []).map((slug) =>
    resolveCategoryDisplayName(slug, categories, labels.uncategorized),
  );

  const seo = buildPostSeo(config, post, authorObj, post.categories[0], env.EFFECTIVE_ORIGIN);

  // Build breadcrumbs: Home > Category > Post (use localized category name)
  const breadcrumbs = [
    { name: config.name, url: '/' },
  ];
  if (post.categories.length > 0) {
    const categoryPrefix = config.routes?.category || 'category';
    breadcrumbs.push({
      name: categoryDisplayNames[0] ?? post.categories[0],
      url: `/${categoryPrefix}/${post.categories[0]}`,
    });
  }
  breadcrumbs.push({
    name: post.title,
    url: buildPostPath(config.routes, post.slug),
  });

  // Strip HTML tags from excerpt for clean meta description
  const plainExcerpt = post.excerpt
    ? post.excerpt.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const enrichPostSummary = <T extends { author: string; categories: string[] }>(item: T) => ({
    ...item,
    authorDisplayName: authorMap.get(item.author)?.name || item.author,
    categoryDisplayNames: (item.categories || []).map((categorySlug) =>
      resolveCategoryDisplayName(categorySlug, categories, labels.uncategorized),
    ),
  });

  const relatedLimit = 3;
  const relatedCategory = post.categories[0];
  const relatedTag = post.tags[0];
  const [relatedByCategory, relatedByTag, relatedLatest] = await Promise.all([
    relatedCategory
      ? getPosts(env.DB, env.SITE_ID, 1, relatedLimit + 2, { category: relatedCategory })
      : Promise.resolve({ posts: [], total: 0 }),
    relatedTag
      ? getPosts(env.DB, env.SITE_ID, 1, relatedLimit + 2, { tag: relatedTag })
      : Promise.resolve({ posts: [], total: 0 }),
    getPosts(env.DB, env.SITE_ID, 1, relatedLimit + 4),
  ]);

  const relatedPosts = mergeRelatedPostGroups(
    [
      relatedByCategory.posts.map(enrichPostSummary),
      relatedByTag.posts.map(enrichPostSummary),
      relatedLatest.posts.map(enrichPostSummary),
    ],
    post.slug,
    relatedLimit,
  );

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const html = render(config.theme || 'default', 'post', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: post.seo?.title || post.title,
    hasCustomTitle: !!post.seo?.title,
    pageDescription: post.seo?.description || plainExcerpt || config.description,
    seo,
    schema: {
      website: buildWebSiteSchema(config, base),
      blogPosting: buildBlogPostingSchema(config, post, authorObj, base),
      breadcrumbList: buildBreadcrumbSchema(config, breadcrumbs, base),
    },
    showHeader: true,
    showFooter: true,
    customPartials,
    post: { ...post, author: effectiveAuthorId || post.author, categoryDisplayNames },
    authorName,
    breadcrumbs,
    showRelatedPosts: relatedPosts.length > 0,
    relatedPosts,
    relatedTitle: isZh ? '继续阅读' : 'Continue reading',
    relatedDescription: isZh
      ? '优先沿着同一市场主线、同一行业或同一主题继续往下读，减少单篇跳出。'
      : 'Continue with closely related coverage from the same market, sector, or theme.',
    defaultPostImage: config.defaults?.post || '',
    preloadImage: post.coverImage || seo.ogImage,
  });

  return htmlResponse(html);
}
