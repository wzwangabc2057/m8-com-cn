
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const type = searchParams.get('type'); // 'category' or 'tag'

  if (!siteId) return errorResponse('Missing siteId');
  if (!type) return errorResponse('Missing type');

  const env = await getEnv();
  try {
    const { results } = await env.DB.prepare(
      'SELECT DISTINCT value FROM post_taxonomies WHERE siteId = ? AND type = ? ORDER BY value ASC'
    ).bind(siteId, type).all<{ value: string }>();

    return jsonResponse({ data: results.map(r => r.value) });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
