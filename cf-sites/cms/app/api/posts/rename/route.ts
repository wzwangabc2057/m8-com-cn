/**
 * POST /api/posts/rename
 * 重命名文章 slug：R2、D1、并添加 301 重定向。
 * Body: { siteId, oldSlug, newSlug }
 */
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { getConfig, putConfig } from '@/lib/r2-utils';
import { getPost, savePost, deletePost } from '@/lib/r2-utils';
import { savePostToD1 } from '@/lib/d1-utils';
import { invalidateCache, postCacheKeys } from '@/lib/cache-invalidation';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json<{ siteId: string; oldSlug: string; newSlug: string }>();
    const siteId = body.siteId?.trim();
    const oldSlug = body.oldSlug?.trim();
    const newSlug = body.newSlug?.trim();

    if (!siteId || !oldSlug || !newSlug) {
      return errorResponse('Missing siteId, oldSlug, or newSlug', 400);
    }
    if (oldSlug === newSlug) {
      return errorResponse('oldSlug and newSlug must be different', 400);
    }
    if (!/^[a-z0-9\-]+$/.test(newSlug)) {
      return errorResponse('newSlug must be lowercase alphanumeric with hyphens only', 400);
    }

    const env = await getEnv();
    const bucket = env.CONTENT_BUCKET;

    // 1. Load post (try posts first, then pages)
    let post = await getPost(bucket, siteId, oldSlug);
    if (!post) return errorResponse('Post not found', 404);

    // 2. Check new slug doesn't already exist
    const existing = await getPost(bucket, siteId, newSlug);
    if (existing) return errorResponse(`Post with slug "${newSlug}" already exists`, 409);

    // 3. Update slug and save to new location
    post.slug = newSlug;
    await savePost(bucket, siteId, post);

    // 4. Delete old R2 file
    await deletePost(bucket, siteId, oldSlug);

    // 5. Update D1: delete old, insert new
    await env.DB.batch([
      env.DB.prepare('DELETE FROM posts WHERE siteId = ? AND slug = ?').bind(siteId, oldSlug),
      env.DB.prepare('DELETE FROM post_taxonomies WHERE siteId = ? AND postSlug = ?').bind(siteId, oldSlug),
    ]);
    await savePostToD1(env.DB, siteId, post);

    // 6. Add redirect to config
    const config = await getConfig(bucket, siteId);
    const postPrefix = config.routes?.post ?? 'blog';
    const fromPath = postPrefix ? `/${postPrefix}/${oldSlug}` : `/${oldSlug}`;
    const toPath = postPrefix ? `/${postPrefix}/${newSlug}` : `/${newSlug}`;

    const redirects = Array.isArray(config.redirects) ? [...config.redirects] : [];
    const idx = redirects.findIndex((r) => r.from === fromPath);
    const rule = { from: fromPath, to: toPath, status: 301 as const };
    if (idx >= 0) redirects[idx] = rule;
    else redirects.push(rule);
    await putConfig(bucket, siteId, { ...config, redirects });

    // 7. Invalidate cache
    await invalidateCache(env.EVENTS_QUEUE, [...postCacheKeys(siteId, oldSlug), ...postCacheKeys(siteId, newSlug)]);

    return jsonResponse({
      success: true,
      oldSlug,
      newSlug,
      redirect: { from: fromPath, to: toPath, status: 301 },
    });
  } catch (err: any) {
    console.error('Post rename error:', err);
    return errorResponse(err?.message ?? 'Rename failed', 500);
  }
}
