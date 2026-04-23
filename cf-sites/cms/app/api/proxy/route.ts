import { getEnv, errorResponse } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key) return errorResponse('Missing key', 400);

  const env = await getEnv();
  const object = await env.CONTENT_BUCKET.get(key);

  if (!object) return errorResponse('Not found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new NextResponse(object.body, { headers });
}
