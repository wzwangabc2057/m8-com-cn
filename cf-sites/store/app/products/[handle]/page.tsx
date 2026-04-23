import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEnv } from '@/lib/cloudflare';
import { getMedusaClient } from '@/lib/medusa';
import { getStoreConfigContext } from '@/lib/config';
import { cachedGet, cacheKeys } from '@/lib/cache';
import { ProductDetailClient } from '@/components/product-detail-client';
import { resolveCurrency, resolveStoreMessages } from '@/lib/i18n';
import { getPricingContext } from '@/lib/pricing-context';
import { getVariantDisplayPrice, toUiProduct } from '@/lib/storefront-product';

export const runtime = 'edge';

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const env = getEnv();
  const { config: storeConfig, cacheScope, language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);
  const medusa = getMedusaClient(env.MEDUSA_BACKEND_URL, storeConfig.medusaPublishableKey);
  const pricingContext = await getPricingContext(env, medusa, language);

  const product = await cachedGet(env.CACHE, cacheKeys.product(cacheScope, handle), async () => {
    try {
      const { products } = await medusa.store.product.list({
        handle,
        fields: '*variants.calculated_price',
        region_id: pricingContext.regionId,
        country_code: pricingContext.countryCode,
      });
      return products?.[0] || null;
    } catch {
      return null;
    }
  });

  if (!product) return { title: messages.productNotFound };

  return {
    title: product.title,
    description: product.description || `${product.title} - ${messages.productMetadataSuffix}`,
    openGraph: {
      title: product.title,
      description: product.description || '',
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const env = getEnv();
  const { config: storeConfig, cacheScope, language } = await getStoreConfigContext();
  const medusa = getMedusaClient(env.MEDUSA_BACKEND_URL, storeConfig.medusaPublishableKey);
  const pricingContext = await getPricingContext(env, medusa, language);

  const product = await cachedGet(env.CACHE, cacheKeys.product(cacheScope, handle), async () => {
    try {
      const { products } = await medusa.store.product.list({
        handle,
        fields: '*variants.calculated_price',
        region_id: pricingContext.regionId,
        country_code: pricingContext.countryCode,
      });
      return products?.[0] || null;
    } catch {
      return null;
    }
  });

  if (!product) notFound();
  const uiProduct = toUiProduct(product);

  const firstVariant = uiProduct.variants?.[0];
  const price = getVariantDisplayPrice(firstVariant);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
          {/* Product image - above fold, no lazy */}
          <div className="aspect-square rounded-3xl overflow-hidden relative bg-slate-50 border border-slate-100 shadow-sm">
            {product.thumbnail ? (
              <img
                src={uiProduct.thumbnail || ''}
                alt={uiProduct.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <span className="text-slate-400 text-6xl font-bold opacity-30">
                  {uiProduct.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col pt-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
              {uiProduct.title}
            </h1>
            <ProductDetailClient product={uiProduct} />
          </div>
        </div>

        {/* Product HTML Content / Description below */}
        {(uiProduct.metadata?.html || uiProduct.metadata?.content || uiProduct.description) && (
          <div className="mt-16 sm:mt-24 max-w-4xl mx-auto">
            <div className="border-t border-slate-200 pt-12 sm:pt-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 tracking-tight text-center">
                Product Details
              </h2>
              <div className="max-w-none text-slate-600 space-y-6 leading-relaxed text-lg 
                            [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:text-slate-900 [&>h1]:mt-8 [&>h1]:mb-4
                            [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-slate-900 [&>h2]:mt-8 [&>h2]:mb-4
                            [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-slate-900 [&>h3]:mt-6 [&>h3]:mb-3
                            [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2
                            [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-2
                            [&>p]:mb-4 [&>img]:rounded-2xl [&>img]:shadow-sm [&>img]:mx-auto">
                {uiProduct.metadata?.html ? (
                  <div dangerouslySetInnerHTML={{ __html: uiProduct.metadata.html as string }} />
                ) : uiProduct.metadata?.content ? (
                  <div dangerouslySetInnerHTML={{ __html: uiProduct.metadata.content as string }} />
                ) : (
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {uiProduct.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JSON-LD - use first variant for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: uiProduct.title,
            description: uiProduct.description,
            image: uiProduct.thumbnail,
            offers: price
              ? {
                  '@type': 'Offer',
                  price: String(price.amount),
                  priceCurrency: resolveCurrency(language, price.currency_code),
                  availability: 'https://schema.org/InStock',
                }
              : undefined,
          }),
        }}
      />
    </div>
  );
}
