/**
 * URL router: parses the request path and returns the matching route info.
 *
 * Supports `routes.post = ''` for prefix-less post URLs (/{slug}).
 */

import type { RouteMapping } from './types.js';

export type RouteMatch =
  | { handler: 'home'; page: number }
  | { handler: 'post'; slug: string }
  | { handler: 'page'; slug: string }
  | { handler: 'collection'; key: string; page: number }
  | { handler: 'category'; slug: string; page: number }
  | { handler: 'tag'; slug: string; page: number }
  | { handler: 'author'; id: string; page: number }
  | { handler: 'notFound' };

/**
 * Get route prefixes from mapping or defaults.
 * An empty string ('') for `post` means posts live at /{slug} with no prefix.
 */
function getRoutePrefixes(routes?: RouteMapping): Required<RouteMapping> {
  return {
    blog: routes?.blog ?? 'blog',
    post: routes?.post ?? 'blog',
    category: routes?.category || 'category',
    tag: routes?.tag || 'tag',
    author: routes?.author || 'author',
  };
}

/**
 * Collect all known route prefixes so that single-segment reserved words
 * (e.g. "category", "tag", "author", "blog") are not mistaken for posts
 * when `post` prefix is empty.
 */
function getReservedPrefixes(prefixes: Required<RouteMapping>): Set<string> {
  const reserved = new Set<string>();
  if (prefixes.blog) reserved.add(prefixes.blog);
  if (prefixes.category) reserved.add(prefixes.category);
  if (prefixes.tag) reserved.add(prefixes.tag);
  if (prefixes.author) reserved.add(prefixes.author);
  // Legacy prefixes
  reserved.add('posts');
  reserved.add('collections');
  return reserved;
}

/**
 * Parse a URL pathname into a RouteMatch.
 *
 * Priority:
 *   /{post-prefix}/:slug  → post          (when post prefix is non-empty)
 *   /{blog-prefix}        → blog list
 *   /category/*           → category
 *   /tag/*                → tag
 *   /author/*             → author
 *   /:slug                → page (if known) or post (if post prefix is empty)
 */
export function matchRoute(pathname: string, knownPageSlugs: string[], routes?: RouteMapping): RouteMatch {
  const prefixes = getRoutePrefixes(routes);
  // Normalize: remove trailing slash (except root)
  const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);

  // Home: check if there's an 'index' page first, otherwise use template
  if (segments.length === 0) {
    // If 'index' exists as a page, use it as the homepage
    if (knownPageSlugs.includes('index')) {
      return { handler: 'page', slug: 'index' };
    }
    // Otherwise, fall back to template-based home
    return { handler: 'home', page: 1 };
  }

  // ── Prefixed post route (non-empty post prefix) ─────────────
  // Post: /{prefix}/:slug
  if (prefixes.post !== '' && segments[0] === prefixes.post && segments.length === 2) {
    return { handler: 'post', slug: segments[1] };
  }

  // ── Blog list ───────────────────────────────────────────────
  // Blog list pagination: /blog/page/:num
  if (prefixes.blog && segments[0] === prefixes.blog && segments.length === 3 && segments[1] === 'page') {
    const page = parseInt(segments[2], 10);
    if (!isNaN(page) && page > 0) {
      return { handler: 'collection', key: 'blog', page };
    }
  }

  // Blog list: /blog
  if (prefixes.blog && segments[0] === prefixes.blog && segments.length === 1) {
    return { handler: 'collection', key: 'blog', page: 1 };
  }

  // ── Legacy support ──────────────────────────────────────────
  // /posts/:slug (backward compatibility)
  if (segments[0] === 'posts' && segments.length === 2) {
    return { handler: 'post', slug: segments[1] };
  }

  // /collections/:key
  if (segments[0] === 'collections' && segments.length >= 2) {
    const key = segments[1];
    if (segments.length === 2) {
      return { handler: 'collection', key, page: 1 };
    }
    if (segments.length === 4 && segments[2] === 'page') {
      const page = parseInt(segments[3], 10);
      if (!isNaN(page) && page > 0) {
        return { handler: 'collection', key, page };
      }
    }
  }

  // ── Category ────────────────────────────────────────────────
  if (segments[0] === prefixes.category && segments.length >= 2) {
    const slug = segments[1];
    if (segments.length === 2) {
      return { handler: 'category', slug, page: 1 };
    }
    if (segments.length === 4 && segments[2] === 'page') {
      const page = parseInt(segments[3], 10);
      if (!isNaN(page) && page > 0) {
        return { handler: 'category', slug, page };
      }
    }
  }

  // ── Tag ─────────────────────────────────────────────────────
  if (segments[0] === prefixes.tag && segments.length >= 2) {
    const slug = segments[1];
    if (segments.length === 2) {
      return { handler: 'tag', slug, page: 1 };
    }
    if (segments.length === 4 && segments[2] === 'page') {
      const page = parseInt(segments[3], 10);
      if (!isNaN(page) && page > 0) {
        return { handler: 'tag', slug, page };
      }
    }
  }

  // ── Author ──────────────────────────────────────────────────
  if (segments[0] === prefixes.author && segments.length >= 2) {
    const id = segments[1];
    if (segments.length === 2) {
      return { handler: 'author', id, page: 1 };
    }
    if (segments.length === 4 && segments[2] === 'page') {
      const page = parseInt(segments[3], 10);
      if (!isNaN(page) && page > 0) {
        return { handler: 'author', id, page };
      }
    }
  }

  // ── Single-segment fallback: Page or prefix-less Post ───────
  if (segments.length === 1) {
    const slug = segments[0];

    // Known page slug → page handler
    if (knownPageSlugs.includes(slug)) {
      return { handler: 'page', slug };
    }

    // When post prefix is empty, any single-segment path that is NOT a
    // reserved route prefix is treated as a potential post.
    // The post handler will return null (→ 404) if no post with that slug exists.
    if (prefixes.post === '') {
      const reserved = getReservedPrefixes(prefixes);
      if (!reserved.has(slug)) {
        return { handler: 'post', slug };
      }
    }
  }

  return { handler: 'notFound' };
}
