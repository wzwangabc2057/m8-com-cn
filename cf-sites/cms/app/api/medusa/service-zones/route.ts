import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const body = await req.json();
  const { fulfillmentSetId, ...data } = body;

  if (!fulfillmentSetId) {
    return errorResponse('fulfillmentSetId is required', 400);
  }

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.createServiceZone(fulfillmentSetId, data);
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa.', 500);
    }
    return errorResponse(msg || 'Failed to create service zone', 500);
  }
}
