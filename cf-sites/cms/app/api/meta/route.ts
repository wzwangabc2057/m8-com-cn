
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface Author {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  url?: string;
  count?: number;
}

interface Category {
  slug: string;
  name: string;
  description?: string;
  featuredImage?: string;
  count?: number;
}

interface Tag {
  slug: string;
  name: string;
  description?: string;
  count?: number;
}

function prefix(siteId: string, path: string): string {
  return `sites/${siteId}/${path}`;
}

async function getJson<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  return obj.json<T>();
}

async function putJson<T>(bucket: R2Bucket, key: string, data: T): Promise<void> {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const withCounts = searchParams.get('withCounts') === 'true';
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const env = await getEnv();
    const bucket = env.CONTENT_BUCKET;

    const [authors, categories, tags] = await Promise.all([
      getJson<Author[]>(bucket, prefix(siteId, 'meta/authors.json'), []),
      getJson<Category[]>(bucket, prefix(siteId, 'meta/categories.json'), []),
      getJson<Tag[]>(bucket, prefix(siteId, 'meta/tags.json'), []),
    ]);

    if (withCounts && env.DB) {
      const categoryCounts = await env.DB.prepare(
        `SELECT value as slug, COUNT(*) as postCount FROM post_taxonomies WHERE siteId = ? AND type = 'category' GROUP BY value`
      )
        .bind(siteId)
        .all<{ slug: string; postCount: number }>();
      const countBySlug = new Map(categoryCounts.results?.map((r) => [r.slug, r.postCount]) ?? []);
      const tagCounts = await env.DB.prepare(
        `SELECT value as slug, COUNT(*) as postCount FROM post_taxonomies WHERE siteId = ? AND type = 'tag' GROUP BY value`
      )
        .bind(siteId)
        .all<{ slug: string; postCount: number }>();
      const tagCountBySlug = new Map(tagCounts.results?.map((r) => [r.slug, r.postCount]) ?? []);
      const categoriesWithCount = categories.map((c) => ({
        ...c,
        postCount: countBySlug.get(c.slug) ?? 0,
      }));
      const tagsWithCount = tags.map((t) => ({
        ...t,
        postCount: tagCountBySlug.get(t.slug) ?? 0,
      }));
      return jsonResponse({ authors, categories: categoriesWithCount, tags: tagsWithCount });
    }

    return jsonResponse({ authors, categories, tags });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const body = await req.json<{ authors?: Author[]; categories?: Category[]; tags?: Tag[] }>();
    const env = await getEnv();
    const bucket = env.CONTENT_BUCKET;

    if (body.authors !== undefined) {
      await putJson(bucket, prefix(siteId, 'meta/authors.json'), body.authors);
    }
    if (body.categories !== undefined) {
      await putJson(bucket, prefix(siteId, 'meta/categories.json'), body.categories);
    }
    if (body.tags !== undefined) {
      await putJson(bucket, prefix(siteId, 'meta/tags.json'), body.tags);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to update meta');
  }
}
