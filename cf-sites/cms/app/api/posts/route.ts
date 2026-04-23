
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { savePost } from '@/lib/r2-utils';
import { savePostToD1 } from '@/lib/d1-utils';
import { NextRequest } from 'next/server';
import type { Post } from '@/lib/types';
import { processContentImages } from '@/lib/image-processor';
import { invalidateCache, postCacheKeys } from '@/lib/cache-invalidation';

export const runtime = 'edge';

const POSTS_BASE = `siteId = ? AND (type = 'post' OR type IS NULL)`;
const POSTS_ORDER = `ORDER BY publishedAt DESC`;

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const search = (searchParams.get('search') || '').trim();
  const status = searchParams.get('status') || 'all';

  const env = await getEnv();

  const whereClause = [POSTS_BASE];
  const bindVars: (string | number)[] = [siteId];
  if (search) {
    whereClause.push(`(title LIKE ? OR slug LIKE ?)`);
    const term = `%${search}%`;
    bindVars.push(term, term);
  }
  if (status !== 'all') {
    whereClause.push(`status = ?`);
    bindVars.push(status);
  }
  const where = whereClause.join(' AND ');

  const [countRow, { results }] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as total FROM posts WHERE ${where}`).bind(...bindVars).first(),
    env.DB.prepare(
      `SELECT * FROM posts WHERE ${where} ${POSTS_ORDER} LIMIT ? OFFSET ?`
    ).bind(...bindVars, limit, offset).all(),
  ]);

  const total = (countRow as { total: number })?.total ?? 0;

  return jsonResponse({ posts: results, total, page, limit });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const post = await req.json<Post>();
    if (!post.slug || !post.title) return errorResponse('Missing required fields');

    // Force type to post
    post.type = 'post';

    const env = await getEnv();
    
    // Process Images (Download external, replace URL)
    if (post.content) {
      post.content = await processContentImages(post.content, siteId, env.CONTENT_BUCKET);
    }

    // 1. Save content to R2
    await savePost(env.CONTENT_BUCKET, siteId, post);

    // 2. Save metadata to D1
    await savePostToD1(env.DB, siteId, post);

    // 3. Invalidate cache for this post
    await invalidateCache(env.EVENTS_QUEUE, postCacheKeys(siteId, post.slug));
    
    return jsonResponse({ success: true, slug: post.slug });
  } catch (err: any) {
    console.error(err);
    return errorResponse(err.message || 'Failed to save post');
  }
}

