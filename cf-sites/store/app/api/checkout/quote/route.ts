import { NextRequest } from 'next/server';
import { prepareCheckoutCart, type CheckoutCartItemInput } from '@/lib/checkout';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    cart?: CheckoutCartItemInput[];
  };

  const result = await prepareCheckoutCart(body.cart || []);
  if ('error' in result) {
    return Response.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return Response.json({
    success: true,
    summary: result.summary,
  });
}
