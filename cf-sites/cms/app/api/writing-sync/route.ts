import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface WritingSyncRow {
  siteId: string;
  projectId: string;
  lastJobId: string | null;
  updatedAt: string;
}

/**
 * GET /api/writing-sync?siteId=xxx
 * Return writing_sync record for a site (requires auth).
 */
export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId', 400);

  const env = await getEnv();
  const row = await env.DB.prepare(
    'SELECT siteId, projectId, lastJobId, updatedAt FROM writing_sync WHERE siteId = ?'
  )
    .bind(siteId)
    .first<WritingSyncRow>();

  if (!row) return jsonResponse({ siteId, projectId: null, lastJobId: null, updatedAt: null });
  return jsonResponse(row);
}

/**
 * PUT /api/writing-sync
 * Body: { siteId, projectId, lastJobId? }
 * Upsert writing_sync record (requires auth).
 */
export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const body = await req.json() as { siteId?: string; projectId?: string; lastJobId?: string };
  const { siteId, projectId, lastJobId } = body;
  if (!siteId || !projectId) return errorResponse('siteId and projectId required', 400);

  const env = await getEnv();
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO writing_sync (siteId, projectId, lastJobId, updatedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(siteId) DO UPDATE SET
       projectId = excluded.projectId,
       lastJobId = COALESCE(excluded.lastJobId, lastJobId),
       updatedAt = excluded.updatedAt`
  )
    .bind(siteId, projectId, lastJobId ?? null, updatedAt)
    .run();

  return jsonResponse({ success: true, siteId, projectId, lastJobId, updatedAt });
}
