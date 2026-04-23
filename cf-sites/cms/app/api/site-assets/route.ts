import { getEnv, errorResponse } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/site-assets?siteId=xxx&path=uploads/2026/02/xxx.webp
 * Serves site assets from R2 for CMS editor preview. path = segment after /site-assets/
 * No auth so <img> requests from the editor can load; same assets are public on the blog.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const path = searchParams.get('path');

  if (!siteId || !path) return errorResponse('Missing siteId or path', 400);
  if (path.includes('..')) return errorResponse('Invalid path', 400);

  const key = `sites/${siteId}/assets/${path.replace(/^\//, '')}`;
  const env = await getEnv();
  const object = await env.CONTENT_BUCKET.get(key);

  if (!object) return errorResponse('Not found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
}
