import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';
import { getSiteSettings } from '@/lib/settings-d1';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
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
    const result = await client.listProducts({ limit, offset, q, sales_channel_id });
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa (API token / Secret Key).', 500);
    }
    const fallback = status ? `Medusa error (HTTP ${status})` : 'Failed to fetch products';
    const message = msg && !/unknown error/i.test(msg) ? msg : fallback;
    if (process.env.NODE_ENV === 'development') console.error('Medusa listProducts error', { message: err?.message, status, err });
    return errorResponse(message, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  
  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }
  
  const body = await req.json();

  // If siteId provided, link product to site's sales channel
  if (siteId) {
    try {
      const site = await getSiteSettings(env.DB, siteId);
      if (site.store?.medusaSalesChannelId) {
        // Medusa v2 expects sales_channels: [{ id: "..." }]
        if (!body.sales_channels) {
          body.sales_channels = [{ id: site.store.medusaSalesChannelId }];
        }
      }
    } catch (e) {
      console.warn('Failed to fetch site settings for sales channel linking', e);
    }
  }

  try {
    const result = await client.createProduct(body);
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa (API token / Secret Key).', 500);
    }
    const fallback = status ? `Medusa error (HTTP ${status})` : 'Failed to create product';
    const message = msg && !/unknown error/i.test(msg) ? msg : fallback;
    if (process.env.NODE_ENV === 'development') console.error('Medusa createProduct error', { message: err?.message, status, err });
    return errorResponse(message, 500);
  }
}
