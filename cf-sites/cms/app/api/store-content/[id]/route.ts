import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { getStoreContentById, saveStoreContent, deleteStoreContent } from '@/lib/store-content-d1';
import type { StoreContent } from '@/lib/types';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId', 400);

  const env = await getEnv();
  const item = await getStoreContentById(env.DB, siteId, id);
  if (!item) return errorResponse('Not found', 404);
  return jsonResponse(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId', 400);

  try {
    const body = await req.json();
    const env = await getEnv();
    const existing = await getStoreContentById(env.DB, siteId, id);
    const now = new Date().toISOString();
    const data: StoreContent = {
      id,
      type: body.type ?? existing?.type ?? 'banner',
      title: body.title ?? existing?.title ?? '',
      subtitle: body.subtitle ?? existing?.subtitle,
      link: body.link ?? existing?.link,
      imageUrl: body.imageUrl ?? existing?.imageUrl,
      startAt: body.startAt ?? existing?.startAt,
      endAt: body.endAt ?? existing?.endAt,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : (existing?.sortOrder ?? 0),
      status: body.status ?? existing?.status ?? 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveStoreContent(env.DB, siteId, data);
    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error(err);
    return errorResponse(err.message ?? 'Failed to update', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId', 400);

  const env = await getEnv();
  await deleteStoreContent(env.DB, siteId, id);
  return jsonResponse({ success: true });
}
