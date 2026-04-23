/**
 * RateLimiterDO - Durable Object for sliding window rate limiting.
 * 
 * Used for:
 * - Checkout: 5 requests/minute
 * - Login: 10 requests/minute
 * - General API: 60 requests/minute
 */

interface RateWindow {
  timestamps: number[];
}

export class RateLimiterDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/check') {
      return this.checkRate(request);
    }

    if (request.method === 'DELETE' && url.pathname === '/reset') {
      await this.storage.deleteAll();
      return Response.json({ reset: true });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async checkRate(request: Request): Promise<Response> {
    const {
      key,
      limit = 60,
      windowMs = 60_000,
    } = await request.json<{
      key: string;
      limit?: number;
      windowMs?: number;
    }>();

    const now = Date.now();
    const window = (await this.storage.get<RateWindow>(key)) || { timestamps: [] };

    // Remove timestamps outside the sliding window
    const cutoff = now - windowMs;
    window.timestamps = window.timestamps.filter((t) => t > cutoff);

    if (window.timestamps.length >= limit) {
      const retryAfter = Math.ceil(
        (window.timestamps[0] + windowMs - now) / 1000,
      );

      return Response.json(
        {
          allowed: false,
          remaining: 0,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // Record this request
    window.timestamps.push(now);
    await this.storage.put(key, window);

    // Set cleanup alarm
    await this.state.storage.setAlarm(now + windowMs + 1000);

    const remaining = limit - window.timestamps.length;

    return Response.json(
      { allowed: true, remaining },
      {
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
        },
      },
    );
  }

  // Cleanup alarm: remove expired windows
  async alarm(): Promise<void> {
    const entries = await this.storage.list<RateWindow>();
    const now = Date.now();
    const deletes: string[] = [];

    for (const [key, window] of entries) {
      if (window.timestamps.every((t) => now - t > 120_000)) {
        deletes.push(key);
      }
    }

    if (deletes.length > 0) {
      await this.storage.delete(deletes);
    }
  }
}
