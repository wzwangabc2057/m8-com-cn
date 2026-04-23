/**
 * CartSessionDO - Durable Object for strongly consistent cart state.
 * 
 * - SQLite-backed for persistence
 * - Multi-tab safe (single writer per cart ID)
 * - Alarm-based cleanup for abandoned carts (24h TTL)
 */

interface CartItem {
  variantId: string;
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  currencyCode?: string;
  thumbnail?: string;
}

interface CartState {
  items: CartItem[];
  updatedAt: string;
  region?: string;
}

export class CartSessionDO implements DurableObject {
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
        case 'GET /cart':
          return this.getCart();
        case 'POST /cart/items':
          return this.addItem(request);
        case 'PUT /cart/items':
          return this.updateItem(request);
        case 'DELETE /cart/items':
          return this.removeItem(request);
        case 'DELETE /cart':
          return this.clearCart();
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

  private async getCartState(): Promise<CartState> {
    const state = await this.storage.get<CartState>('cart');
    return state || { items: [], updatedAt: new Date().toISOString() };
  }

  private async saveCartState(cart: CartState): Promise<void> {
    cart.updatedAt = new Date().toISOString();
    await this.storage.put('cart', cart);
    // Reset abandon timer to 24 hours
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }

  private async getCart(): Promise<Response> {
    const cart = await this.getCartState();
    return Response.json(cart);
  }

  private async addItem(request: Request): Promise<Response> {
    const { variantId, productId, title, quantity = 1, unitPrice, currencyCode, thumbnail } =
      await request.json<CartItem & Record<string, unknown>>();

    if (!variantId || !productId) {
      return Response.json({ error: 'variantId and productId required' }, { status: 400 });
    }

    const cart = await this.getCartState();
    const existing = cart.items.find((i) => i.variantId === variantId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ variantId, productId, title, quantity, unitPrice, currencyCode, thumbnail });
    }

    await this.saveCartState(cart);
    return Response.json(cart);
  }

  private async updateItem(request: Request): Promise<Response> {
    const { variantId, quantity } = await request.json<{ variantId: string; quantity: number }>();

    const cart = await this.getCartState();
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.variantId !== variantId);
    } else {
      item.quantity = quantity;
    }

    await this.saveCartState(cart);
    return Response.json(cart);
  }

  private async removeItem(request: Request): Promise<Response> {
    const { variantId } = await request.json<{ variantId: string }>();

    const cart = await this.getCartState();
    cart.items = cart.items.filter((i) => i.variantId !== variantId);

    await this.saveCartState(cart);
    return Response.json(cart);
  }

  private async clearCart(): Promise<Response> {
    const cart: CartState = { items: [], updatedAt: new Date().toISOString() };
    await this.storage.put('cart', cart);
    await this.state.storage.deleteAlarm();
    return Response.json(cart);
  }

  // Alarm handler: clean up abandoned carts
  async alarm(): Promise<void> {
    await this.storage.deleteAll();
  }
}
