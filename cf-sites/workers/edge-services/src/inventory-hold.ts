/**
 * InventoryHoldDO - Durable Object for temporary inventory reservation.
 * 
 * During checkout, holds inventory for 5 minutes to prevent overselling.
 * Automatically releases on alarm expiry.
 */

interface Hold {
  variantId: string;
  quantity: number;
  sessionId: string;
  createdAt: string;
}

export class InventoryHoldDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      switch (`${method} ${url.pathname}`) {
        case 'POST /hold':
          return this.createHold(request);
        case 'DELETE /hold':
          return this.releaseHold(request);
        case 'POST /confirm':
          return this.confirmHold(request);
        case 'GET /status':
          return this.getStatus();
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async createHold(request: Request): Promise<Response> {
    const { variantId, quantity, sessionId } = await request.json<Hold>();

    if (!variantId || !quantity || !sessionId) {
      return Response.json({ error: 'variantId, quantity, sessionId required' }, { status: 400 });
    }

    const holds = (await this.storage.get<Hold[]>('holds')) || [];

    // Check total held quantity
    const totalHeld = holds.reduce((sum, h) => sum + h.quantity, 0);
    const available = await this.storage.get<number>('available') ?? Infinity;

    if (totalHeld + quantity > available) {
      return Response.json({ error: 'Insufficient inventory' }, { status: 409 });
    }

    holds.push({
      variantId,
      quantity,
      sessionId,
      createdAt: new Date().toISOString(),
    });

    await this.storage.put('holds', holds);

    // Set alarm for 5 minutes to auto-release
    await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);

    return Response.json({ held: true, totalHeld: totalHeld + quantity });
  }

  private async releaseHold(request: Request): Promise<Response> {
    const { sessionId } = await request.json<{ sessionId: string }>();
    const holds = (await this.storage.get<Hold[]>('holds')) || [];
    const filtered = holds.filter((h) => h.sessionId !== sessionId);
    await this.storage.put('holds', filtered);
    return Response.json({ released: true });
  }

  private async confirmHold(request: Request): Promise<Response> {
    const { sessionId } = await request.json<{ sessionId: string }>();
    const holds = (await this.storage.get<Hold[]>('holds')) || [];
    const confirmed = holds.filter((h) => h.sessionId === sessionId);
    const remaining = holds.filter((h) => h.sessionId !== sessionId);

    // Update available count
    const available = await this.storage.get<number>('available') ?? Infinity;
    const deducted = confirmed.reduce((sum, h) => sum + h.quantity, 0);

    if (available !== Infinity) {
      await this.storage.put('available', available - deducted);
    }

    await this.storage.put('holds', remaining);
    return Response.json({ confirmed: true, deducted });
  }

  private async getStatus(): Promise<Response> {
    const holds = (await this.storage.get<Hold[]>('holds')) || [];
    const available = await this.storage.get<number>('available') ?? Infinity;
    const totalHeld = holds.reduce((sum, h) => sum + h.quantity, 0);
    return Response.json({ available, totalHeld, holds: holds.length });
  }

  // Alarm: release expired holds
  async alarm(): Promise<void> {
    const holds = (await this.storage.get<Hold[]>('holds')) || [];
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    const active = holds.filter(
      (h) => now - new Date(h.createdAt).getTime() < fiveMinutes,
    );

    await this.storage.put('holds', active);

    // Re-set alarm if there are still active holds
    if (active.length > 0) {
      const oldest = Math.min(...active.map((h) => new Date(h.createdAt).getTime()));
      await this.state.storage.setAlarm(oldest + fiveMinutes);
    }
  }
}
