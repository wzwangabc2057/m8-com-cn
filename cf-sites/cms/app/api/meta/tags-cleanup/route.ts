/**
 * POST /api/meta/tags-cleanup
 * 移除指定标签（从 meta 与 D1），并将使用这些标签的文章重定向到 mergeInto。
 */

import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

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
    const mergeInto = (body.mergeInto?.trim() || 'general').toLowerCase();

    if (!siteId) return errorResponse('Missing siteId', 400);
    if (removeSlugs.length === 0) {
      return jsonResponse({ success: true, removed: 0, d1Updated: 0, message: 'No slugs to remove' });
    }

    const env = await getEnv();
    const bucket = env.CONTENT_BUCKET;
    const key = `sites/${siteId}/meta/tags.json`;

    const tags = await getJson<{ slug: string; name: string }[]>(bucket, key, []);
    const toRemove = new Set(removeSlugs);
    let kept = tags.filter((t) => !toRemove.has(t.slug));
    if (mergeInto && !kept.some((t) => t.slug === mergeInto)) {
      kept.push({ slug: mergeInto, name: mergeInto.replace(/-/g, ' ') });
    }
    await putJson(bucket, key, kept);

    let d1Updated = 0;
    if (env.DB) {
      for (const slug of removeSlugs) {
        await env.DB.prepare(
          `DELETE FROM post_taxonomies WHERE siteId = ? AND type = 'tag' AND value = ?
           AND postSlug IN (SELECT postSlug FROM post_taxonomies WHERE siteId = ? AND type = 'tag' AND value = ?)`
        )
          .bind(siteId, slug, siteId, mergeInto)
          .run();
        const r = await env.DB.prepare(
          `UPDATE post_taxonomies SET value = ? WHERE siteId = ? AND type = 'tag' AND value = ?`
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
      message: `Removed tags: ${removeSlugs.join(', ')}; reassigned ${d1Updated} post(s) to "${mergeInto}".`,
    });
  } catch (err: any) {
    return errorResponse(err?.message ?? 'Cleanup failed', 500);
  }
}
