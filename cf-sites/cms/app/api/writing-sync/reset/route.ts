import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/writing-sync/reset
 * Body: { siteId }
 * Sets lastJobId = NULL for the site so the next cron sync will process from the earliest completed job.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const body = await req.json().catch(() => ({})) as { siteId?: string };
  const { siteId } = body;
  if (!siteId) return errorResponse('siteId required', 400);

  const env = await getEnv();
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE writing_sync SET lastJobId = NULL, updatedAt = ? WHERE siteId = ?'
  )
    .bind(updatedAt, siteId)
    .run();

  return jsonResponse({
    success: true,
    siteId,
    updatedAt,
  });
}
