// This file will replace the logic in cms/lib/r2-utils.ts for writing posts.
// But we still need R2 for the content body.

import type { Post } from './types';

/** Canonical slug for "uncategorized" so blog can show it in the site's language. */
const UNCATEGORIZED_SLUG = 'uncategorized';

/** Values that should be stored as uncategorized in D1. */
const UNCATEGORIZED_ALIASES = new Set([
  'uncategorized',
  '未分类',
  'Uncategorized',
  '未分類',
  'CHƯA PHÂN LOẠI'
]);

function normalizeCategory(value: string): string {
  const t = value?.trim();
  if (!t) return UNCATEGORIZED_SLUG;
  return UNCATEGORIZED_ALIASES.has(t) ? UNCATEGORIZED_SLUG : t;
}

// D1 binding is expected to be available on process.env in Next.js on Pages
// But accessing it is tricky. Usually we use getRequestContext().env.DB

export async function savePostToD1(db: D1Database, siteId: string, post: Post): Promise<void> {
  const batch = [];

  // 1. Upsert Post Metadata
  batch.push(db.prepare(`
    INSERT INTO posts (siteId, slug, title, excerpt, coverImage, author, collection, publishedAt, updatedAt, type, status, seo, layout, showTitle, showHeader, showFooter, containerClass, customCss, customJs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(siteId, slug) DO UPDATE SET
      title=excluded.title,
      excerpt=excluded.excerpt,
      coverImage=excluded.coverImage,
      author=excluded.author,
      collection=excluded.collection,
      publishedAt=excluded.publishedAt,
      updatedAt=excluded.updatedAt,
      type=excluded.type,
      status=excluded.status,
      seo=excluded.seo,
      layout=excluded.layout,
      showTitle=excluded.showTitle,
      showHeader=excluded.showHeader,
      showFooter=excluded.showFooter,
      containerClass=excluded.containerClass,
      customCss=excluded.customCss,
      customJs=excluded.customJs
  `).bind(
    siteId,
    post.slug,
    post.title,
    post.excerpt || null,
    post.coverImage || null,
    post.author || null,
    post.collection || null,
    post.publishedAt,
    new Date().toISOString(),
    post.type || 'post',
    post.status || 'published',
    post.seo ? JSON.stringify(post.seo) : null,
    post.layout || 'default',
    post.showTitle ?? true,
    post.showHeader ?? true,
    post.showFooter ?? true,
    post.containerClass || null,
    (post as any).customCss || null,
    (post as any).customJs || null
  ));

  // 2. Clear old taxonomies
  batch.push(db.prepare(`
    DELETE FROM post_taxonomies WHERE siteId = ? AND postSlug = ?
  `).bind(siteId, post.slug));

  // 3. Insert new taxonomies
  if (post.tags && post.tags.length > 0) {
    for (const tag of post.tags) {
      batch.push(db.prepare(`
        INSERT INTO post_taxonomies (siteId, postSlug, type, value) VALUES (?, ?, 'tag', ?)
      `).bind(siteId, post.slug, tag));
    }
  }

  const categoriesToSave =
    post.categories && post.categories.length > 0
      ? [...new Set(post.categories.map(normalizeCategory))]
      : [UNCATEGORIZED_SLUG];
  for (const cat of categoriesToSave) {
    batch.push(db.prepare(`
      INSERT INTO post_taxonomies (siteId, postSlug, type, value) VALUES (?, ?, 'category', ?)
    `).bind(siteId, post.slug, cat));
  }

  await db.batch(batch);
}

export async function deletePostFromD1(db: D1Database, siteId: string, slug: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM posts WHERE siteId = ? AND slug = ?').bind(siteId, slug),
    db.prepare('DELETE FROM post_taxonomies WHERE siteId = ? AND postSlug = ?').bind(siteId, slug)
  ]);
}
