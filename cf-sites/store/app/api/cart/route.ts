/**
 * Cart API Route - BFF for CartSessionDO
 * 
 * GET /api/cart?session=xxx    -> Get cart
 * POST /api/cart               -> Add/update/remove/clear cart items
 */

import { getEnv } from '@/lib/cloudflare';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get('session');
  if (!session) {
    return Response.json({ items: [], updatedAt: '' });
  }

  const { EDGE_SERVICES } = getEnv();
  const res = await EDGE_SERVICES.fetch(
    `https://edge-services/do/cart/cart?session=${encodeURIComponent(session)}`,
  );
  const data = await res.json();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    action?: string;
    session?: string;
    variantId?: string;
    productId?: string;
    title?: string;
    variantTitle?: string;
    quantity?: number;
    unitPrice?: number;
    currencyCode?: string;
    thumbnail?: string;
  };
  const { action, session, ...rest } = body;

  if (!session) {
    return Response.json({ error: 'session required' }, { status: 400 });
  }

  const { EDGE_SERVICES } = getEnv();
  const baseUrl = `https://edge-services/do/cart`;

  let res: Response;

  switch (action) {
    case 'add':
      res = await EDGE_SERVICES.fetch(`${baseUrl}/cart/items?session=${encodeURIComponent(session)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      break;

    case 'update':
      res = await EDGE_SERVICES.fetch(`${baseUrl}/cart/items?session=${encodeURIComponent(session)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: rest.variantId, quantity: rest.quantity }),
      });
      break;

    case 'remove':
      res = await EDGE_SERVICES.fetch(`${baseUrl}/cart/items?session=${encodeURIComponent(session)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: rest.variantId }),
      });
      break;

    case 'clear':
      res = await EDGE_SERVICES.fetch(`${baseUrl}/cart?session=${encodeURIComponent(session)}`, {
        method: 'DELETE',
      });
      break;

    default:
      return Response.json({ error: 'Unknown action' }, { status: 400 });
  }

  const data = await res.json();
  return Response.json(data);
}
