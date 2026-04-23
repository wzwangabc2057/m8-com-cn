/**
 * POST /api/meta/categories-cleanup
 * 移除指定分类（从 meta 与 D1），并将使用这些分类的文章重定向到 mergeInto（默认 uncategorized）。
 * 供子 agent 在 AI 判断「不合理/无用」分类后调用。
 */

import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const UNCATEGORIZED = 'uncategorized';

async function getJson<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  return obj.json<T>();
}

async function putJson(bucket: R2Bucket, key: string, data: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json<{
      siteId: string;
      removeSlugs: string[];
      mergeInto?: string;
    }>();
    const siteId = body.siteId?.trim();
    const removeSlugs = Array.isArray(body.removeSlugs)
      ? body.removeSlugs.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const mergeInto = (body.mergeInto?.trim() || UNCATEGORIZED).toLowerCase();

    if (!siteId) return errorResponse('Missing siteId', 400);
    if (removeSlugs.length === 0) {
      return jsonResponse({ success: true, removed: 0, d1Updated: 0, message: 'No slugs to remove' });
    }

    const env = await getEnv();
    const bucket = env.CONTENT_BUCKET;
    const key = `sites/${siteId}/meta/categories.json`;

    const categories = await getJson<{ slug: string; name: string }[]>(bucket, key, []);
    const toRemove = new Set(removeSlugs);
    let kept = categories.filter((c) => !toRemove.has(c.slug));
    if (mergeInto && !kept.some((c) => c.slug === mergeInto)) {
      kept.push({ slug: mergeInto, name: mergeInto.replace(/-/g, ' ') });
    }
    await putJson(bucket, key, kept);

    let d1Updated = 0;
    if (env.DB) {
      for (const slug of removeSlugs) {
        // Posts that have BOTH slug and mergeInto: delete slug row to avoid UNIQUE violation
        await env.DB.prepare(
          `DELETE FROM post_taxonomies WHERE siteId = ? AND type = 'category' AND value = ?
           AND postSlug IN (SELECT postSlug FROM post_taxonomies WHERE siteId = ? AND type = 'category' AND value = ?)`
        )
          .bind(siteId, slug, siteId, mergeInto)
          .run();
        // Posts that have only slug: update to mergeInto
        const r = await env.DB.prepare(
          `UPDATE post_taxonomies SET value = ? WHERE siteId = ? AND type = 'category' AND value = ?`
        )
          .bind(mergeInto, siteId, slug)
          .run();
        d1Updated += (r as { meta?: { changes?: number } }).meta?.changes ?? 0;
      }
    }

    return jsonResponse({
      success: true,
      removed: removeSlugs.length,
      keptCount: kept.length,
      d1Updated,
      mergeInto,
      message: `Removed categories: ${removeSlugs.join(', ')}; reassigned ${d1Updated} post(s) to "${mergeInto}".`,
    });
  } catch (err: any) {
    return errorResponse(err?.message ?? 'Cleanup failed', 500);
  }
}
