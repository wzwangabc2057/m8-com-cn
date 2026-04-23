import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();

  const [postsRow, pagesRow] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) as total FROM posts WHERE siteId = ? AND (type = 'post' OR type IS NULL)`
    )
      .bind(siteId)
      .first(),
    env.DB.prepare(`SELECT COUNT(*) as total FROM posts WHERE siteId = ? AND type = 'page'`)
      .bind(siteId)
      .first(),
  ]);

  const posts = (postsRow as { total: number })?.total ?? 0;
  const pages = (pagesRow as { total: number })?.total ?? 0;

  return jsonResponse({ posts, pages });
}
