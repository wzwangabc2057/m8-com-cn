'use client';

import { useState, useMemo } from 'react';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { useStoreI18n } from '@/providers/store-i18n-provider';
import { getVariantDisplayPrice, type UiProduct, type UiProductVariant } from '@/lib/storefront-product';

function buildVariantTitle(variant: UiProductVariant): string {
  if (variant.title) return variant.title;
  const opts = variant.options?.map((o) => o.value ?? o.option?.value).filter(Boolean) as string[];
  return opts?.length ? opts.join(' / ') : '';
}

export function ProductDetailClient({ product }: { product: UiProduct }) {
  const { messages, formatPrice } = useStoreI18n();
  const variants = product.variants ?? [];
  const hasMultipleVariants = variants.length > 1;

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? variants[0],
    [variants, selectedVariantId],
  );

  const price = getVariantDisplayPrice(selectedVariant);
  const variantTitle = selectedVariant ? buildVariantTitle(selectedVariant) : '';

  return (
    <div className="flex flex-col">
      {price ? (
        <p className="text-3xl font-extrabold text-blue-600 mb-6">
          {formatPrice(price.amount, price.currency_code)}
        </p>
      ) : (
        <p className="text-3xl font-extrabold text-slate-400 mb-6">
          Coming soon
        </p>
      )}

      {hasMultipleVariants && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
            {messages.chooseVariant}
          </h3>
          <div className="flex flex-wrap gap-3">
            {variants.map((v) => {
              const label = buildVariantTitle(v) || v.id.slice(0, 8);
              const isSelected = selectedVariantId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`min-h-[44px] px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="pt-2">
          <AddToCartButton
            variantId={selectedVariant.id}
            productId={product.id}
            title={product.title}
            unitPrice={price?.amount ?? 0}
            currencyCode={price?.currency_code}
            thumbnail={product.thumbnail ?? undefined}
            variantTitle={variantTitle || undefined}
          />
        </div>
      )}

      {product.tags && product.tags.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
            {messages.tags}
          </h3>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag: { id: string; value: string }) => (
              <span
                key={tag.id}
                className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200"
              >
                {tag.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
