
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { scanAllPostFiles, scanAllPageFiles } from '@/lib/r2-utils';
import { savePostToD1 } from '@/lib/d1-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const env = await getEnv();

    const [posts, pagesDir] = await Promise.all([
      scanAllPostFiles(env.CONTENT_BUCKET, siteId),
      scanAllPageFiles(env.CONTENT_BUCKET, siteId),
    ]);

    await env.DB.prepare('DELETE FROM posts WHERE siteId = ?').bind(siteId).run();
    await env.DB.prepare('DELETE FROM post_taxonomies WHERE siteId = ?').bind(siteId).run();

    let successCount = 0;
    const errors: any[] = [];
    const allItems = [...posts, ...pagesDir];
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.slug, item])).values());

    for (const item of uniqueItems) {
      try {
        await savePostToD1(env.DB, siteId, item);
        successCount++;
      } catch (e: any) {
        console.error(`Failed to index ${item.type} ${item.slug}:`, e);
        errors.push({ slug: item.slug, type: item.type, error: e.message });
      }
    }

    return jsonResponse({
      success: true,
      scanned: uniqueItems.length,
      indexed: successCount,
      details: {
        posts: posts.length,
        pages_dir: pagesDir.length,
      },
      errors,
    });
    
  } catch (err: any) {
    console.error(err);
    return errorResponse(err.message || 'Failed to rebuild index');
  }
}

