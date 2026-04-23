import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { searchParams } = new URL(req.url);
  const stock_location_id = searchParams.getAll('stock_location_id').filter(Boolean);

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.listFulfillmentSets({
      stock_location_id: stock_location_id.length ? stock_location_id : undefined,
    });
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa.', 500);
    }
    return errorResponse(msg || 'Failed to fetch fulfillment sets', 500);
  }
}
