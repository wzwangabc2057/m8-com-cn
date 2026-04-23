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
  
  // Filters
  const status = searchParams.getAll('status');
  const payment_status = searchParams.getAll('payment_status');
  const fulfillment_status = searchParams.getAll('fulfillment_status');

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
    const result = await client.listOrders({
      limit,
      offset,
      q,
      status: status.length ? status : undefined,
      payment_status: payment_status.length ? payment_status : undefined,
      fulfillment_status: fulfillment_status.length ? fulfillment_status : undefined,
      sales_channel_id,
    });
    return jsonResponse(result);
  } catch (err: any) {
    const msg = String(err?.message ?? '').trim();
    const errStatus = err?.status ?? err?.response?.status;
    if (errStatus === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa (API token / Secret Key).', 500);
    }
    // If 500 and we were filtering by sales_channel_id, retry without channel filter so the user can at least see orders
    if (errStatus === 500 && sales_channel_id?.length) {
      try {
        const fallbackResult = await client.listOrders({
          limit,
          offset,
          q,
          status: status.length ? status : undefined,
          payment_status: payment_status.length ? payment_status : undefined,
          fulfillment_status: fulfillment_status.length ? fulfillment_status : undefined,
          sales_channel_id: undefined,
        });
        return jsonResponse({
          ...fallbackResult,
          _warning: 'Orders loaded without sales channel filter (Medusa returned 500 when filtering by channel). Check Medusa backend logs.',
        });
      } catch (_) {
        // Fall through to return original error
      }
    }
    const fallback = errStatus ? `Medusa error (HTTP ${errStatus})` : 'Failed to fetch orders';
    const detail = msg || fallback;
    const hint = errStatus === 500
      ? ' Check Medusa backend logs for the real cause. If you use a hosted Medusa (e.g. Railway), check the service logs.'
      : '';
    const message = errStatus ? `Medusa (HTTP ${errStatus}): ${detail}${hint}` : detail + hint;
    if (process.env.NODE_ENV === 'development') console.error('Medusa listOrders error', { message: err?.message, errStatus, err });
    return errorResponse(message, 500);
  }
}
