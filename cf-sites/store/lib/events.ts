/**
 * Queue event producer for the Store service.
 * Sends async events to the storefront-events queue.
 */

import { getEnv } from './cloudflare';

interface CacheInvalidateEvent {
  type: 'cache-invalidate';
  keys: string[];
}

interface AnalyticsEvent {
  type: 'analytics';
  event: string;
  siteId: string;
  data: Record<string, string | number>;
}

interface NotificationEvent {
  type: 'notification';
  channel: 'email' | 'webhook';
  payload: Record<string, unknown>;
}

type QueueEvent = CacheInvalidateEvent | AnalyticsEvent | NotificationEvent;

/**
 * Send an event to the storefront queue.
 */
export async function sendEvent(event: QueueEvent): Promise<void> {
  const { EVENTS_QUEUE } = getEnv();
  await EVENTS_QUEUE.send(event);
}

/**
 * Invalidate cache keys via the queue.
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  await sendEvent({ type: 'cache-invalidate', keys });
}

/**
 * Track an analytics event via the queue.
 */
export async function trackEvent(
  event: string,
  siteId: string,
  data: Record<string, string | number> = {},
): Promise<void> {
  await sendEvent({ type: 'analytics', event, siteId, data });
}

/**
 * Send a notification via the queue.
 */
export async function sendNotification(
  channel: 'email' | 'webhook',
  payload: Record<string, unknown>,
): Promise<void> {
  await sendEvent({ type: 'notification', channel, payload });
}
