/**
 * One-off migration: normalize "未分类" / "Uncategorized" / "未分類" to slug "uncategorized"
 * in D1 post_taxonomies. Display names stay localized in the blog via i18n.
 */

import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  try {
    const env = await getEnv();

    // Update all category taxonomy values that are uncategorized aliases to canonical slug
    const stmt = env.DB.prepare(`
      UPDATE post_taxonomies
      SET value = 'uncategorized'
      WHERE type = 'category'
        AND (value = ? OR value = ? OR value = ? OR value = ?)
    `);
    const result = await stmt.bind('未分类', 'Uncategorized', '未分類', 'CHƯA PHÂN LOẠI').run();

    // result.meta.changes is not always present; result.success is
    const changes = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;

    return jsonResponse({
      success: true,
      d1Updated: changes,
      message: `Normalized uncategorized category slug in D1 (rows updated: ${changes}).`,
    });
  } catch (err: any) {
    console.error('[migrate/uncategorized-slug]', err);
    return errorResponse(err.message ?? 'Migration failed', 500);
  }
}
