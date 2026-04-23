import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { savePost } from '@/lib/r2-utils';
import type { Post } from '@/lib/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  const bucket = env.CONTENT_BUCKET;
  const logs: string[] = [];
  const listPrefix = `sites/${siteId}/pages/`;

  try {
    const listed = await bucket.list({ prefix: listPrefix });

    for (const obj of listed.objects) {
      const key = obj.key;
      if (!key.endsWith('.html')) continue;

      const filename = key.slice(listPrefix.length);
      const slug = filename.replace('.html', '');
      logs.push(`Processing ${slug}...`);

      const postData: Post = {
        slug,
        title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
        excerpt: '',
        content: '',
        type: 'page',
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        categories: [],
        tags: [],
        collection: '',
        author: '',
        layout: 'default',
        showTitle: true,
        showHeader: true,
        showFooter: true,
      };

      const htmlObj = await bucket.get(key);
      if (htmlObj) {
        postData.content = await htmlObj.text();
      }

      await savePost(bucket, siteId, postData);
      logs.push(`  - Saved to posts/${slug}.json`);

      await bucket.delete(key);
      logs.push(`  - Deleted ${key}`);
    }

    const registryKey = `sites/${siteId}/pages/_registry.json`;
    try {
      await bucket.delete(registryKey);
      logs.push('Deleted _registry.json (if present)');
    } catch {
      /* ignore */
    }

    return jsonResponse({ success: true, logs });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
