import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const env = await getEnv();

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    const result = await client.getRegion(id);
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err?.message || 'Failed to fetch region', 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const result = await client.updateRegion(id, body);
    return jsonResponse(result);
  } catch (err: any) {
    return errorResponse(err?.message || 'Failed to update region', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { id } = await params;
  const env = await getEnv();

  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }

  try {
    await client.deleteRegion(id);
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || 'Failed to delete region', 500);
  }
}
