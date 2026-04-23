import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  const list = await env.CONTENT_BUCKET.list({
    prefix: `sites/${siteId}/assets/`,
  });

  const assets = list.objects.map((obj) => {
    const key = obj.key;
    const pathPart = key.replace(`sites/${siteId}/assets/`, '');
    return {
      key,
      size: obj.size,
      uploaded: obj.uploaded,
      url: `/api/proxy?key=${encodeURIComponent(key)}`,
      publicUrl: pathPart ? `/site-assets/${pathPart}` : undefined,
    };
  });

  return jsonResponse({ assets });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const overwriteParam = searchParams.get('overwrite'); // 'true' or 'false', default 'true'
  const overwrite = overwriteParam !== 'false';

  if (!siteId) return errorResponse('Missing siteId');

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const filename = formData.get('filename') as string || file.name;

  if (!file) return errorResponse('No file provided');

  const env = await getEnv();
  
  // Use date-based path: sites/{siteId}/assets/YYYY/MM/filename
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const key = `sites/${siteId}/assets/${year}/${month}/${filename}`;
  const pathPart = `${year}/${month}/${filename}`;
  const url = `/api/proxy?key=${encodeURIComponent(key)}`;
  const publicUrl = `/site-assets/${pathPart}`;

  // If overwrite is disabled, check if file exists
  if (!overwrite) {
    const existing = await env.CONTENT_BUCKET.head(key);
    if (existing) {
      return jsonResponse({ success: true, key, url, publicUrl, existing: true });
    }
  }
  
  await env.CONTENT_BUCKET.put(key, file, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  return jsonResponse({ success: true, key, url, publicUrl });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const key = searchParams.get('key');

  if (!siteId || !key) return errorResponse('Missing parameters', 400);

  const env = await getEnv();
  // Ensure we are only deleting assets for this site
  if (!key.startsWith(`sites/${siteId}/assets/`)) {
    return errorResponse('Invalid key scope', 403);
  }

  await env.CONTENT_BUCKET.delete(key);
  return jsonResponse({ success: true });
}
