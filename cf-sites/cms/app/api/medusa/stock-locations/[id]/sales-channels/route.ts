import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const env = await getEnv();
  const body = await req.json();

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.updateStockLocationSalesChannels(id, body);
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err?.message || 'Failed to update sales channels', 500);
  }
}
