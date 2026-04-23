import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { id } = await params;
  
  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.getOrder(id);
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to fetch order', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  const { id } = await params;
  const body = await req.json();
  const { action, ...data } = body;

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    let result;
    switch (action) {
      case 'fulfill':
        result = await client.createFulfillment(id, data.items, data.no_notification);
        break;
      case 'ship':
        result = await client.createShipment(id, data.fulfillment_id, data.tracking_numbers, data.no_notification);
        break;
      case 'capture':
        result = await client.capturePayment(id);
        break;
      default:
        return errorResponse('Invalid action', 400);
    }
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to process action', 500);
  }
}
