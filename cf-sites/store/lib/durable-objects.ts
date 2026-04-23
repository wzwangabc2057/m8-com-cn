/**
 * Durable Object stub helpers.
 * 
 * Access CartSessionDO, InventoryHoldDO, RateLimiterDO
 * via the EDGE_SERVICES service binding.
 */

import { getEnv } from './cloudflare';

/**
 * Fetch cart state from CartSessionDO.
 */
export async function fetchCart(sessionId: string) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/cart/cart?session=${encodeURIComponent(sessionId)}`;
  const res = await EDGE_SERVICES.fetch(url);
  return res.json();
}

/**
 * Add item to cart via CartSessionDO.
 */
export async function addToCart(
  sessionId: string,
  item: { variantId: string; productId: string; title: string; quantity: number; unitPrice: number; currencyCode?: string; thumbnail?: string },
) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/cart/cart/items?session=${encodeURIComponent(sessionId)}`;
  const res = await EDGE_SERVICES.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  return res.json();
}

/**
 * Update item quantity in cart.
 */
export async function updateCartItem(sessionId: string, variantId: string, quantity: number) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/cart/cart/items?session=${encodeURIComponent(sessionId)}`;
  const res = await EDGE_SERVICES.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId, quantity }),
  });
  return res.json();
}

/**
 * Remove item from cart.
 */
export async function removeFromCart(sessionId: string, variantId: string) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/cart/cart/items?session=${encodeURIComponent(sessionId)}`;
  const res = await EDGE_SERVICES.fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId }),
  });
  return res.json();
}

/**
 * Check rate limit via RateLimiterDO.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/rate-limit/check`;
  const res = await EDGE_SERVICES.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, limit, windowMs }),
  });
  return res.json() as Promise<{ allowed: boolean; remaining: number; retryAfter?: number }>;
}

/**
 * Create inventory hold via InventoryHoldDO.
 */
export async function createInventoryHold(
  variantId: string,
  quantity: number,
  sessionId: string,
) {
  const { EDGE_SERVICES } = getEnv();
  const url = `https://edge-services/do/inventory/hold?variant=${encodeURIComponent(variantId)}`;
  const res = await EDGE_SERVICES.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId, quantity, sessionId }),
  });
  return res.json();
}
