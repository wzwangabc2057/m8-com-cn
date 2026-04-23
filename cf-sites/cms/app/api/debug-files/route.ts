
import { getEnv, jsonResponse, requireAuth, errorResponse } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  
  // Debug: List everything under the site prefix to see directory structure
  const rootPrefix = `sites/${siteId}/`;
  
  // List with delimiter to emulate folders
  const rootList = await env.CONTENT_BUCKET.list({ prefix: rootPrefix, delimiter: '/' });
  
  const pagesPrefix = `sites/${siteId}/pages/`;
  const pagesList = await env.CONTENT_BUCKET.list({ prefix: pagesPrefix });

  return jsonResponse({
    siteId,
    root_folders: rootList.delimitedPrefixes,
    pages_files: pagesList.objects.map(o => o.key),
  });
}
