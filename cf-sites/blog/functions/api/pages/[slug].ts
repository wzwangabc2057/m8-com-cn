import { getPost, putPost } from '../../../src/services/content.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Post } from '../../../src/types.js';

function normalizeCategory(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'uncategorized';
  return trimmed === '未分类' ? 'uncategorized' : trimmed;
}

async function savePageToD1(db: D1Database, siteId: string, post: Post): Promise<void> {
  const batch = [];

  batch.push(
    db.prepare(`
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
      post.updatedAt || new Date().toISOString(),
      'page',
      post.status || 'published',
      post.seo ? JSON.stringify(post.seo) : null,
      (post as any).layout || 'default',
      (post as any).showTitle ?? true,
      (post as any).showHeader ?? true,
      (post as any).showFooter ?? true,
      (post as any).containerClass || null,
      (post as any).customCss || null,
      (post as any).customJs || null,
    ),
  );

  batch.push(db.prepare('DELETE FROM post_taxonomies WHERE siteId = ? AND postSlug = ?').bind(siteId, post.slug));

  const categories = post.categories?.length
    ? [...new Set(post.categories.map(normalizeCategory))]
    : ['uncategorized'];

  for (const category of categories) {
    batch.push(
      db.prepare('INSERT INTO post_taxonomies (siteId, postSlug, type, value) VALUES (?, ?, ?, ?)')
        .bind(siteId, post.slug, 'category', category),
    );
  }

  for (const tag of post.tags || []) {
    batch.push(
      db.prepare('INSERT INTO post_taxonomies (siteId, postSlug, type, value) VALUES (?, ?, ?, ?)')
        .bind(siteId, post.slug, 'tag', tag),
    );
  }

  await db.batch(batch);
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const post = await getPost(env.CONTENT_BUCKET, env.SITE_ID, slug);
  if (!post) return errorResponse('Page not found', 404);
  if (post.type !== 'page') return errorResponse('Not a page', 404);

  return jsonResponse(post);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;

  let body: Partial<Post>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const existing = await getPost(env.CONTENT_BUCKET, env.SITE_ID, slug);

  const post: Post = {
    ...(existing || {
      slug,
      title: body.title || slug,
      excerpt: body.excerpt || '',
      content: body.content || '',
      type: 'page',
      status: 'published',
      publishedAt: body.publishedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: body.author || '',
      categories: body.categories || [],
      tags: body.tags || [],
      collection: body.collection || '',
    }),
    ...body,
    slug,
    type: 'page',
    status: body.status || existing?.status || 'published',
    updatedAt: new Date().toISOString(),
  };

  await putPost(env.CONTENT_BUCKET, env.SITE_ID, post);
  await savePageToD1(env.DB, env.SITE_ID, post);

  return jsonResponse({ success: true, slug });
};
