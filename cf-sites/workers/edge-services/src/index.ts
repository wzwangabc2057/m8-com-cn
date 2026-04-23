/**
 * Edge Services Worker
 * 
 * Hosts Durable Objects (CartSessionDO, InventoryHoldDO, RateLimiterDO)
 * and processes Queue events (cache invalidation, analytics, notifications).
 * 
 * This worker has no external routes — it's accessed via:
 * - Service bindings from the Store service (for DO stubs)
 * - Queue consumer binding (for async events)
 */

export { CartSessionDO } from './cart-session.js';
export { InventoryHoldDO } from './inventory-hold.js';
export { RateLimiterDO } from './rate-limiter.js';

import { handleQueueBatch } from './queue-consumer.js';

interface Env {
  CACHE: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  CART_SESSION: DurableObjectNamespace;
  INVENTORY_HOLD: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
}

export default {
  // Minimal fetch handler — this worker is primarily for DO + Queue
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'edge-services',
        durableObjects: ['CartSessionDO', 'InventoryHoldDO', 'RateLimiterDO'],
      });
    }

    // Proxy to CartSessionDO
    if (url.pathname.startsWith('/do/cart/')) {
      const sessionId = url.searchParams.get('session');
      if (!sessionId) {
        return Response.json({ error: 'session parameter required' }, { status: 400 });
      }
      const id = env.CART_SESSION.idFromName(sessionId);
      const stub = env.CART_SESSION.get(id);
      const doUrl = new URL(request.url);
      doUrl.pathname = doUrl.pathname.replace('/do/cart', '');
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // Proxy to InventoryHoldDO
    if (url.pathname.startsWith('/do/inventory/')) {
      const variantId = url.searchParams.get('variant');
      if (!variantId) {
        return Response.json({ error: 'variant parameter required' }, { status: 400 });
      }
      const id = env.INVENTORY_HOLD.idFromName(variantId);
      const stub = env.INVENTORY_HOLD.get(id);
      const doUrl = new URL(request.url);
      doUrl.pathname = doUrl.pathname.replace('/do/inventory', '');
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // Proxy to RateLimiterDO
    if (url.pathname.startsWith('/do/rate-limit/')) {
      const id = env.RATE_LIMITER.idFromName('global');
      const stub = env.RATE_LIMITER.get(id);
      const doUrl = new URL(request.url);
      doUrl.pathname = doUrl.pathname.replace('/do/rate-limit', '');
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    return new Response('Edge Services Worker', { status: 200 });
  },

  // Queue consumer
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    await handleQueueBatch(batch as MessageBatch<any>, env);
  },
};
