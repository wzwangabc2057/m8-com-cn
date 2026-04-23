'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { CheckoutForm } from '@/components/checkout-form';
import { Turnstile } from '@/components/turnstile';
import { useStoreI18n } from '@/providers/store-i18n-provider';
import Link from 'next/link';

interface CheckoutSummary {
  currencyCode?: string;
  subtotal: number;
  shippingTotal: number;
  total: number;
  shippingOptionName?: string;
  paymentProviderId?: string;
}

interface CheckoutSuccessState {
  displayId?: number;
  total?: number;
  currencyCode?: string;
}

export default function CheckoutPage() {
  const { cart, itemCount, clearCart } = useCart();
  const { messages, formatPrice } = useStoreI18n();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CheckoutSuccessState | null>(null);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const currencyCode = summary?.currencyCode || cart.items[0]?.currencyCode;
  const total = summary?.total ?? subtotal;
  const paymentMethodName = useMemo(() => {
    if (!summary?.paymentProviderId) return messages.estimatedShippingLabel;
    if (summary.paymentProviderId === 'pp_system_default') {
      return messages.manualPaymentLabel;
    }
    return summary.paymentProviderId;
  }, [messages.estimatedShippingLabel, messages.manualPaymentLabel, summary?.paymentProviderId]);

  useEffect(() => {
    if (itemCount === 0) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoadingSummary(true);

    fetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      }),
    })
      .then(async (res) => {
        const data = await res.json() as { error?: string; summary?: CheckoutSummary };
        if (!res.ok) {
          throw new Error(data.error || messages.submitRetry);
        }
        return { summary: data.summary as CheckoutSummary };
      })
      .then((data) => {
        if (!cancelled) {
          setSummary(data.summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cart.items, itemCount, messages.submitRetry]);

  if (itemCount === 0 && !success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-heading)' }}>
          {messages.checkoutEmptyTitle}
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>{messages.checkoutEmptyDescription}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-primary)', color: 'white' }}
          aria-hidden
        >
          <Check className="w-8 h-8" strokeWidth={3} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-heading)' }}>
          {messages.orderSubmittedTitle}
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>{messages.orderSubmittedDescription}</p>
        <div className="mt-6 rounded-xl border p-5 text-left" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
          {success.displayId ? (
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {messages.orderNumberLabel}: <span className="font-semibold" style={{ color: 'var(--color-heading)' }}>#{success.displayId}</span>
            </p>
          ) : null}
          {success.total !== undefined ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {messages.orderTotalLabel}: <span className="font-semibold" style={{ color: 'var(--color-heading)' }}>
                {formatPrice(success.total, success.currencyCode)}
              </span>
            </p>
          ) : null}
        </div>
        <div className="mt-8">
          <Link
            href="/store"
            className="inline-block px-6 py-3 rounded-xl text-white font-medium"
            style={{ background: 'var(--color-primary)' }}
          >
            {messages.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: Record<string, string>) => {
    if (turnstileEnabled && !turnstileToken) {
      setError(messages.completeVerification);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
          cart: cart.items,
        }),
      });

      const data = await res.json() as {
        error?: string;
        code?: string;
        displayId?: number;
        total?: number;
        currencyCode?: string;
      };

      if (!res.ok) {
        if (data.code === 'TURNSTILE_FAILED') {
          throw new Error(messages.completeVerification);
        }
        if (data.code === 'RATE_LIMITED') {
          throw new Error(messages.rateLimited);
        }
        if (data.code === 'NO_SHIPPING_OPTION') {
          throw new Error(messages.noShippingOption);
        }
        if (data.code === 'NO_PAYMENT_PROVIDER') {
          throw new Error(messages.noPaymentProvider);
        }
        if (data.code === 'EMPTY_CART') {
          throw new Error(messages.emptyCheckoutCart);
        }
        throw new Error(data.error || messages.submitFailed);
      }

      await clearCart();
      setSuccess({
        displayId: data.displayId,
        total: data.total,
        currencyCode: data.currencyCode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.submitRetry);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-10 tracking-tight">
          {messages.checkout}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
          {/* Form */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <CheckoutForm onSubmit={handleSubmit} submitting={submitting} />

            {/* Turnstile */}
            <div className="mt-8 pt-8 border-t border-slate-100">
              <Turnstile
                onVerify={setTurnstileToken}
                onAvailabilityChange={(enabled) => {
                  setTurnstileEnabled(enabled);
                  if (!enabled) {
                    setTurnstileToken(null);
                  }
                }}
              />
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm h-fit sticky top-24">
            <h2 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">
              {messages.orderSummary}
            </h2>
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.variantId} className="flex justify-between items-start text-sm gap-4">
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-900">{item.title}</span> <span className="text-slate-400">×</span> {item.quantity}
                  </span>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    {formatPrice(item.unitPrice * item.quantity, item.currencyCode)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{messages.subtotalLabel}</span>
                <span className="font-medium text-slate-900">{formatPrice(subtotal, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{messages.shippingLabel}</span>
                <span className="font-medium text-slate-900">
                  {loadingSummary
                    ? messages.submitting
                    : summary
                      ? formatPrice(summary.shippingTotal, summary.currencyCode)
                      : messages.estimatedShippingLabel}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{messages.shippingMethodLabel}</span>
                <span className="font-medium text-slate-900">
                  {summary?.shippingOptionName || messages.estimatedShippingLabel}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{messages.paymentMethodLabel}</span>
                <span className="font-medium text-slate-900">{paymentMethodName}</span>
              </div>
              <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-lg">{messages.totalLabel}</span>
                <span className="font-extrabold text-2xl text-blue-600">
                  {formatPrice(total, currencyCode)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
