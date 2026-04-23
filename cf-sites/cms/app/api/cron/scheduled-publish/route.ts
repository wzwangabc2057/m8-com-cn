/**
 * Cron: 定时发布
 * 每日执行，按站点配置的「每日自动发布篇数」将草稿转为已发布。
 * 触发：Cloudflare Cron 或外部定时调用 GET/POST，需带 X-Cron-Secret 或 Authorization: Bearer <CRON_SECRET>。
 */

import { getEnv, jsonResponse, errorResponse } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { getConfig, getPost, savePost } from '@/lib/r2-utils';
import { savePostToD1 } from '@/lib/d1-utils';
import { invalidateCache, postCacheKeys } from '@/lib/cache-invalidation';
import type { Post } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 120;

function requireCronAuth(req: NextRequest, env: { CRON_SECRET?: string }): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('X-Cron-Secret') || req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return auth === secret;
}

async function runScheduledPublish(req: NextRequest) {
  const env = await getEnv();
  if (!requireCronAuth(req, env as { CRON_SECRET?: string })) {
    return errorResponse('Unauthorized', 401);
  }

  const bucket = env.CONTENT_BUCKET;
  const db = env.DB;

  const siteIds: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const list = await bucket.list({ prefix: 'sites/', delimiter: '/', cursor });
    for (const prefix of list.delimitedPrefixes) {
      const parts = prefix.split('/');
      if (parts[1]) siteIds.push(parts[1]);
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  const results: { siteId: string; published: string[]; skipped: string; error?: string }[] = [];

  for (const siteId of siteIds) {
    try {
      const config = await getConfig(bucket, siteId);
      const postsPerDay = (config as { publish?: { postsPerDay?: number } }).publish?.postsPerDay ?? 10;
      if (postsPerDay <= 0) {
        results.push({ siteId, published: [], skipped: 'publish disabled (postsPerDay ≤ 0)' });
        continue;
      }

      // 只发布草稿，不发布已归档（archived=真下线，不参与定时发布）
      const { results: rows } = await db
        .prepare(
          `SELECT slug FROM posts WHERE siteId = ? AND status = 'draft' AND (type = 'post' OR type IS NULL) ORDER BY updatedAt ASC LIMIT ?`
        )
        .bind(siteId, postsPerDay)
        .all();

      const slugs = (rows as { slug: string }[]).map((r) => r.slug);
      const published: string[] = [];

      for (const slug of slugs) {
        try {
          const post = await getPost(bucket, siteId, slug);
          if (!post || (post.type && post.type !== 'post')) continue;

          const now = new Date().toISOString();
          const updated: Post = {
            ...post,
            status: 'published',
            publishedAt: now,
            updatedAt: now,
          };

          await savePost(bucket, siteId, updated);
          await savePostToD1(db, siteId, updated);
          await invalidateCache(env.EVENTS_QUEUE, postCacheKeys(siteId, slug));
          published.push(slug);
        } catch (e) {
          console.error(`[scheduled-publish] ${siteId}/${slug} failed:`, e);
        }
      }

      results.push({
        siteId,
        published,
        skipped: postsPerDay <= 0 ? 'disabled' : '',
      });
    } catch (err: any) {
      results.push({
        siteId,
        published: [],
        skipped: '',
        error: err?.message ?? String(err),
      });
    }
  }

  return jsonResponse({
    ok: true,
    ranAt: new Date().toISOString(),
    sites: results,
    summary: {
      totalSites: siteIds.length,
      totalPublished: results.reduce((acc, r) => acc + r.published.length, 0),
    },
  });
}

export async function GET(req: NextRequest) {
  return runScheduledPublish(req);
}

export async function POST(req: NextRequest) {
  return runScheduledPublish(req);
}
