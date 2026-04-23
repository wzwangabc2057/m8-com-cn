'use client';

import { useToast } from '@/providers/toast-provider';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { useStoreI18n } from '@/providers/store-i18n-provider';

interface AddToCartButtonProps {
  variantId: string;
  productId: string;
  title: string;
  unitPrice: number;
  currencyCode?: string;
  thumbnail?: string;
  /** e.g. "红色 / M" for cart line display */
  variantTitle?: string;
}

export function AddToCartButton({
  variantId,
  productId,
  title,
  unitPrice,
  currencyCode,
  thumbnail,
  variantTitle,
}: AddToCartButtonProps) {
  const { addItem, loading } = useCart();
  const { showToast } = useToast();
  const { messages } = useStoreI18n();

  const handleAddToCart = async () => {
    try {
      await addItem({
        variantId,
        productId,
        title,
        unitPrice,
        currencyCode,
        thumbnail,
        variantTitle,
      });
      showToast(messages.addToCartSuccess, 'success');
    } catch (err) {
      showToast(messages.addToCartError, 'error');
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      className="flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-semibold text-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
    >
      <ShoppingCart className="w-5 h-5" />
      {loading ? messages.addingToCart : messages.addToCart}
    </button>
  );
}
