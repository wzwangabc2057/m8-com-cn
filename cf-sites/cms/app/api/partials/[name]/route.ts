
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);
  
  const { name } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  const key = `sites/${siteId}/partials/${name}.html`;
  
  const obj = await env.CONTENT_BUCKET.get(key);
  if (!obj) return jsonResponse({ content: '' }); 
  
  const content = await obj.text();
  return jsonResponse({ content });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { name } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  let content = '';
  try {
    const body = await req.json<{ content: string }>();
    content = body.content;
  } catch (e) {
    return errorResponse('Invalid JSON body');
  }
  
  const env = await getEnv();
  const key = `sites/${siteId}/partials/${name}.html`;
  
  await env.CONTENT_BUCKET.put(key, content || '', {
    httpMetadata: { contentType: 'text/html' }
  });

  return jsonResponse({ success: true, key });
}
