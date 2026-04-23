/**
 * Queue Consumer - Processes async events from the storefront queue.
 * 
 * Event types:
 * - cache-invalidate: Delete specific KV cache keys
 * - analytics: Write analytics data to Analytics Engine
 * - notification: Forward to email/webhook services
 */

interface QueueEnv {
  CACHE: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
}

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

export async function handleQueueBatch(
  batch: MessageBatch<QueueEvent>,
  env: QueueEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processEvent(message.body, env);
      message.ack();
    } catch (err) {
      console.error(`Queue event failed:`, err, message.body);
      message.retry();
    }
  }
}

async function processEvent(event: QueueEvent, env: QueueEnv): Promise<void> {
  switch (event.type) {
    case 'cache-invalidate':
      await handleCacheInvalidate(event, env);
      break;
    case 'analytics':
      handleAnalytics(event, env);
      break;
    case 'notification':
      await handleNotification(event);
      break;
    default:
      console.warn('Unknown event type:', (event as { type: string }).type);
  }
}

async function handleCacheInvalidate(
  event: CacheInvalidateEvent,
  env: QueueEnv,
): Promise<void> {
  const deletes = event.keys.map(async (key) => {
    // Support wildcard suffix with KV list
    if (key.endsWith(':*')) {
      const prefix = key.slice(0, -2);
      const list = await env.CACHE.list({ prefix });
      await Promise.all(list.keys.map((k) => env.CACHE.delete(k.name)));
    } else {
      await env.CACHE.delete(key);
    }
  });

  await Promise.all(deletes);
  console.log(`Cache invalidated: ${event.keys.length} key pattern(s)`);
}

function handleAnalytics(event: AnalyticsEvent, env: QueueEnv): void {
  const blobs: string[] = [event.event, event.siteId];
  const doubles: number[] = [];

  for (const [k, v] of Object.entries(event.data)) {
    if (typeof v === 'string') blobs.push(v);
    if (typeof v === 'number') doubles.push(v);
  }

  env.ANALYTICS.writeDataPoint({
    blobs,
    doubles,
    indexes: [event.siteId],
  });
}

async function handleNotification(event: NotificationEvent): Promise<void> {
  // Placeholder: Forward to external notification service
  // Can be extended to support email (Resend, Sendgrid) or webhooks
  console.log(`Notification [${event.channel}]:`, JSON.stringify(event.payload));
}
