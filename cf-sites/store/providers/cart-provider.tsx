'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

interface CartItem {
  variantId: string;
  productId: string;
  title: string;
  /** Variant options summary e.g. "红色 / M" for display in cart */
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  currencyCode?: string;
  thumbnail?: string;
}

interface CartState {
  items: CartItem[];
  updatedAt: string;
}

interface CartContextType {
  cart: CartState;
  itemCount: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => Promise<void>;
  updateItem: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  loading: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = document.cookie.match(/(?:^|;\s*)cart_session=([^;]*)/)?.[1];
  if (!id) {
    id = crypto.randomUUID();
    document.cookie = `cart_session=${id};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
  }
  return id;
}

function syncCartCountCookie(count: number) {
  // Set cart_count cookie for cross-service badge sync (blog reads this)
  document.cookie = `cart_count=${count};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({ items: [], updatedAt: '' });
  const [loading, setLoading] = useState(false);

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch cart on mount
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    fetch(`/api/cart?session=${sessionId}`)
      .then((r) => r.json() as Promise<CartState>)
      .then((data) => {
        setCart(data);
        syncCartCountCookie(data.items.reduce((s, i) => s + i.quantity, 0));
      })
      .catch(() => {});
  }, []);

  const addItem = useCallback(
    async (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            session: getSessionId(),
            ...item,
            quantity: item.quantity ?? 1,
          }),
        });
        const data: CartState = await res.json();
        setCart(data);
        syncCartCountCookie(data.items.reduce((s, i) => s + i.quantity, 0));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateItem = useCallback(async (variantId: string, quantity: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          session: getSessionId(),
          variantId,
          quantity,
        }),
      });
      const data: CartState = await res.json();
      setCart(data);
      syncCartCountCookie(data.items.reduce((s, i) => s + i.quantity, 0));
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (variantId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          session: getSessionId(),
          variantId,
        }),
      });
      const data: CartState = await res.json();
      setCart(data);
      syncCartCountCookie(data.items.reduce((s, i) => s + i.quantity, 0));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', session: getSessionId() }),
      });
      const data: CartState = await res.json();
      setCart(data);
      syncCartCountCookie(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <CartContext.Provider value={{ cart, itemCount, addItem, updateItem, removeItem, clearCart, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
