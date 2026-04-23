import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { listStoreContent, saveStoreContent } from '@/lib/store-content-d1';
import type { StoreContent } from '@/lib/types';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const status = searchParams.get('status') ?? undefined;
  if (!siteId) return errorResponse('Missing siteId', 400);

  const env = await getEnv();
  const items = await listStoreContent(env.DB, siteId, { status });
  return jsonResponse({ items });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId', 400);

  try {
    const body = await req.json();
    const id = body.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const data: StoreContent = {
      id,
      type: body.type ?? 'banner',
      title: body.title ?? '',
      subtitle: body.subtitle,
      link: body.link,
      imageUrl: body.imageUrl,
      startAt: body.startAt,
      endAt: body.endAt,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      status: body.status ?? 'active',
      createdAt: body.createdAt ?? now,
      updatedAt: now,
    };
    if (!data.title) return errorResponse('Missing title', 400);

    const env = await getEnv();
    await saveStoreContent(env.DB, siteId, data);
    return jsonResponse({ success: true, id: data.id });
  } catch (err: any) {
    console.error(err);
    return errorResponse(err.message ?? 'Failed to save', 500);
  }
}
