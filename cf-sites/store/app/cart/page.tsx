'use client';

import Link from 'next/link';
import { useCart } from '@/providers/cart-provider';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useStoreI18n } from '@/providers/store-i18n-provider';

export default function CartPage() {
  const { cart, itemCount, updateItem, removeItem, loading } = useCart();
  const { messages, formatPrice } = useStoreI18n();

  const total = cart.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const currencyCode = cart.items[0]?.currencyCode;

  if (itemCount === 0) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-16rem)] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-8 h-8 text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            {messages.emptyCartTitle}
          </h1>
          <p className="text-slate-500 mb-8 font-medium">
            {messages.emptyCartDescription}
          </p>
          <Link
            href="/store"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            {messages.browseProducts}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-10 tracking-tight">
          {messages.cartTitle(itemCount)}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Cart Items List */}
          <div className="lg:col-span-8 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.variantId}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Thumbnail */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                      <span className="text-slate-400 font-bold opacity-30 text-2xl">{item.title.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg line-clamp-2">
                        {item.title}
                      </h3>
                      {item.variantTitle && (
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                          {item.variantTitle}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-lg whitespace-nowrap">
                      {formatPrice(item.unitPrice * item.quantity, item.currencyCode)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    {/* Quantity controls */}
                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                      <button
                        onClick={() => updateItem(item.variantId, item.quantity - 1)}
                        disabled={loading}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 transition-all"
                        aria-label={messages.decreaseQuantity}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-semibold text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.variantId, item.quantity + 1)}
                        disabled={loading}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50 transition-all"
                        aria-label={messages.increaseQuantity}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.variantId)}
                      disabled={loading}
                      className="p-2.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label={messages.removeItem(item.title)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 sticky top-24">
              <h2 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">
                Order Summary
              </h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">{formatPrice(total, currencyCode)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="text-sm">Calculated at checkout</span>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-lg">{messages.totalLabel}</span>
                  <span className="font-extrabold text-2xl text-blue-600">
                    {formatPrice(total, currencyCode)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-200"
              >
                {messages.checkout}
                <ArrowRight className="w-5 h-5" />
              </Link>
              
              <div className="mt-6 text-center">
                <Link href="/store" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
