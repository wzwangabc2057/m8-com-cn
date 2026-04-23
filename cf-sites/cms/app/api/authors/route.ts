
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  try {
    const { results } = await env.DB.prepare(
      'SELECT DISTINCT author FROM posts WHERE siteId = ? AND author IS NOT NULL AND author != "" ORDER BY author ASC'
    ).bind(siteId).all<{ author: string }>();

    return jsonResponse({ data: results.map(r => r.author) });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
