export interface ProductPrice {
  amount: number;
  currency_code?: string;
}

export interface UiProductVariant {
  id: string;
  title?: string;
  options?: Array<{ value?: string; option?: { value?: string } }>;
  prices?: ProductPrice[];
  calculated_price?: {
    calculated_amount?: number;
    currency_code?: string;
  } | null;
}

export interface UiProduct {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  variants?: UiProductVariant[] | null;
  tags?: Array<{ id: string; value: string }> | null;
  metadata?: Record<string, any> | null;
}

export function getVariantDisplayPrice(variant?: UiProductVariant | null): ProductPrice | null {
  if (!variant) return null;

  if (variant.calculated_price?.calculated_amount !== undefined) {
    return {
      amount: variant.calculated_price.calculated_amount,
      currency_code: variant.calculated_price.currency_code,
    };
  }

  return variant.prices?.[0] || null;
}

export function toUiProduct(product: any): UiProduct {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    thumbnail: product.thumbnail,
    variants: product.variants || null,
    tags: product.tags || null,
    metadata: product.metadata || null,
  };
}
