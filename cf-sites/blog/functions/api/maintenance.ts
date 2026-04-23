import { rebuildAll } from '../../src/services/indexing.js';
import { requireAuth, jsonResponse, errorResponse } from '../../src/utils/auth.js';
import type { Env } from '../../src/types.js';

/**
 * POST /api/maintenance
 * Body: { "action": "rebuild" }
 *
 * Rebuilds all indexes, feeds, and meta from individual post files.
 * Use after migration or to fix corrupted data.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: { action: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body. Expected: { "action": "rebuild" }');
  }

  if (body.action === 'rebuild') {
    const start = Date.now();
    const result = await rebuildAll(env.CONTENT_BUCKET, env.SITE_ID);
    const elapsed = Date.now() - start;

    return jsonResponse({
      success: true,
      action: 'rebuild',
      posts: result.total,
      feeds: result.feeds,
      elapsed: `${elapsed}ms`,
    });
  }

  return errorResponse(`Unknown action: ${body.action}. Available: rebuild`);
};
