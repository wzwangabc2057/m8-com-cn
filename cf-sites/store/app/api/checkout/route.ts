/**
 * Checkout API Route
 * 
 * POST /api/checkout -> Process checkout
 * - Verify Turnstile token
 * - Check rate limit
 * - Create inventory holds
 * - Forward to Medusa for order creation
 */

import { getEnv } from '@/lib/cloudflare';
import { completeCheckoutCart, type CheckoutCartItemInput } from '@/lib/checkout';
import { getStoreConfigContext } from '@/lib/config';
import { resolveStoreMessages } from '@/lib/i18n';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const env = getEnv();
  const body = await request.json() as {
    turnstileToken?: string;
    cart?: CheckoutCartItemInput[];
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    note?: string;
  };
  const { turnstileToken, cart, name, email, phone, address, city, note } = body;
  const { resolvedSiteId, language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);

  // 1. Verify Turnstile token
  if (turnstileToken) {
    const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim() || '';
    if (turnstileSecret) {
    const formData = new URLSearchParams();
      formData.append('secret', turnstileSecret);
      formData.append('response', turnstileToken);

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });
      const verifyData = await verifyRes.json() as { success: boolean };

      if (!verifyData.success) {
        return Response.json({ error: 'Turnstile verification failed', code: 'TURNSTILE_FAILED' }, { status: 403 });
      }
    }
  }

  // 2. Check rate limit via Edge Services
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitRes = await env.EDGE_SERVICES.fetch('https://edge-services/do/rate-limit/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: `checkout:${clientIp}`, limit: 5, windowMs: 60000 }),
  });

  const rateLimit = await rateLimitRes.json() as { allowed: boolean };
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  if (!cart?.length) {
    return Response.json({ error: messages.emptyCheckoutCart, code: 'EMPTY_CART' }, { status: 400 });
  }

  if (!email || !phone || !address || !city || !name) {
    return Response.json({ error: 'Missing required checkout fields', code: 'INVALID_CHECKOUT_DATA' }, { status: 400 });
  }

  const completion = await completeCheckoutCart(cart, {
    name,
    email,
    phone,
    address,
    city,
    note,
  });

  if ('error' in completion) {
    const status =
      completion.code === 'NO_SHIPPING_OPTION' || completion.code === 'NO_PAYMENT_PROVIDER' || completion.code === 'EMPTY_CART'
        ? 400
        : 500;
    return Response.json({ error: completion.error, code: completion.code }, { status });
  }

  // 4. Track analytics event
  try {
    await env.EVENTS_QUEUE.send({
      type: 'analytics',
      event: 'checkout_completed',
      siteId: resolvedSiteId,
      data: {
        items: cart?.length || 0,
        ip: clientIp,
      },
    });
  } catch {
    // Non-blocking
  }

  return Response.json({
    success: true,
    message: 'Order created',
    type: completion.orderResult?.type,
    orderId: completion.orderResult?.order?.id,
    displayId: completion.orderResult?.order?.display_id,
    total: completion.orderResult?.order?.total,
    currencyCode: completion.orderResult?.order?.currency_code,
    subtotal: completion.summary.subtotal,
    shippingTotal: completion.summary.shippingTotal,
    shippingOptionName: completion.summary.shippingOptionName,
    paymentProviderId: completion.summary.paymentProviderId,
  });
}
