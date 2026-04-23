import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';
import { getSiteSettings } from '@/lib/settings-d1';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const q = searchParams.get('q') || undefined;
  const siteId = searchParams.get('siteId') || undefined;

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  let sales_channel_id: string[] | undefined;
  if (siteId) {
    try {
      const site = await getSiteSettings(env.DB, siteId);
      if (site.store?.medusaSalesChannelId) {
        sales_channel_id = [site.store.medusaSalesChannelId];
      }
    } catch (_) {}
  }

  try {
    const result = await client.listStockLocations({ limit, offset, q, sales_channel_id });
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa.', 500);
    }
    return errorResponse(msg || 'Failed to fetch stock locations', 500);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const body = await req.json();

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.createStockLocation(body);
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa.', 500);
    }
    return errorResponse(msg || 'Failed to create stock location', 500);
  }
}
