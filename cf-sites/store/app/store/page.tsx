import type { Metadata } from 'next';
import { getEnv } from '@/lib/cloudflare';
import { getMedusaClient } from '@/lib/medusa';
import { getStoreConfigContext } from '@/lib/config';
import { cachedGet, cacheKeys } from '@/lib/cache';
import { ProductGrid } from '@/components/product-grid';
import { Pagination } from '@/components/ui/pagination';
import { resolveStoreMessages } from '@/lib/i18n';
import { getPricingContext } from '@/lib/pricing-context';
import { toUiProduct } from '@/lib/storefront-product';
import { ShieldCheck, Truck, RotateCcw, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Force edge runtime for Cloudflare Pages
export const runtime = 'edge';

const ITEMS_PER_PAGE = 20;

interface Props {
  searchParams?: Promise<{
    page?: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);

  return {
    title: messages.storePageTitle,
    description: messages.storePageDescription,
  };
}

export default async function StorePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const env = getEnv();
  const { config: storeConfig, cacheScope, language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);
  const medusa = getMedusaClient(env.MEDUSA_BACKEND_URL, storeConfig.medusaPublishableKey);
  const pricingContext = await getPricingContext(env, medusa, language);

  // Fetch products with KV cache
  let products = [];
  let count = 0;
  
  if (env.CACHE) {
    const cached = await cachedGet(
      env.CACHE,
      cacheKeys.products(cacheScope, page),
      async () => {
        try {
          const res = await medusa.store.product.list({
            limit: ITEMS_PER_PAGE,
            offset,
            fields: '*variants.calculated_price',
            region_id: pricingContext.regionId,
            country_code: pricingContext.countryCode,
          });
          return { products: res.products || [], count: res.count || 0 };
        } catch (err) {
          console.error('Error fetching products:', err);
          return { products: [], count: 0 };
        }
      },
      { ttl: 300 },
    );
    products = cached.products;
    count = cached.count;
  } else {
    try {
      const res = await medusa.store.product.list({
        limit: ITEMS_PER_PAGE,
        offset,
        fields: '*variants.calculated_price',
        region_id: pricingContext.regionId,
        country_code: pricingContext.countryCode,
      });
      products = res.products || [];
      count = res.count || 0;
    } catch (err) {
      console.error('Error fetching products without cache:', err);
    }
  }
  const uiProducts = products.map(toUiProduct);

  const heroConfig = storeConfig.homepage || {};
  const hasHeroImage = !!heroConfig.heroImage;
  const isFirstPage = page === 1;

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      {isFirstPage && (
        <section className={`relative w-full ${hasHeroImage ? 'h-[85vh] min-h-[600px] max-h-[800px]' : 'bg-slate-50 border-b border-slate-200 py-20 sm:py-32'}`}>
          {hasHeroImage && (
            <div className="absolute inset-0">
              <img
                src={heroConfig.heroImage!}
                alt={heroConfig.heroTitle || messages.storeHeroTitle}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent"></div>
            </div>
          )}
          
          <div className={`relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-24 ${hasHeroImage ? 'items-start text-left' : 'items-center text-center justify-center pb-0'}`}>
            <div className={`max-w-3xl ${hasHeroImage ? 'opacity-0 translate-y-8 animate-[fade-in-up_1s_ease-out_forwards]' : ''}`}>
              <h1 className={`text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] ${hasHeroImage ? 'text-white' : 'text-slate-900'}`}>
                {heroConfig.heroTitle || messages.storeHeroTitle}
              </h1>
              <p className={`text-xl sm:text-2xl font-medium mb-10 max-w-2xl leading-relaxed ${hasHeroImage ? 'text-slate-200' : 'text-slate-600'}`}>
                {heroConfig.heroSubtitle || messages.storeHeroSubtitle}
              </p>
              {heroConfig.heroButtonText && heroConfig.heroButtonLink && (
                <a 
                  href={heroConfig.heroButtonLink}
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                >
                  {heroConfig.heroButtonText}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Value Propositions */}
      {isFirstPage && (
        <section className="border-b border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100">
              <div className="flex flex-col items-center text-center px-4">
                <Truck className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">Free Shipping</h3>
                <p className="text-sm text-slate-500">On all orders over ฿1,000</p>
              </div>
              <div className="flex flex-col items-center text-center px-4">
                <ShieldCheck className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">Secure Payment</h3>
                <p className="text-sm text-slate-500">100% secure checkout</p>
              </div>
              <div className="flex flex-col items-center text-center px-4">
                <RotateCcw className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">Easy Returns</h3>
                <p className="text-sm text-slate-500">30 day return policy</p>
              </div>
              <div className="flex flex-col items-center text-center px-4">
                <Clock className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">24/7 Support</h3>
                <p className="text-sm text-slate-500">Dedicated online support</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <div id="products" className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isFirstPage ? 'py-20' : 'py-12'}`}>
        <div className="mb-14 flex flex-col sm:flex-row items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {heroConfig.featuredProductsTitle || 'Featured Collection'}
            </h2>
            <p className="text-slate-500 mt-2 text-lg">Discover our latest arrivals and premium selections.</p>
          </div>
          {isFirstPage && count > ITEMS_PER_PAGE && (
            <Link href="/store?page=2" className="text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1 transition-colors">
              View all products <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {products.length > 0 ? (
          <div className="space-y-16">
            <ProductGrid products={uiProducts} />
            <div className="pt-8">
              <Pagination
                currentPage={page}
                totalItems={count}
                itemsPerPage={ITEMS_PER_PAGE}
                baseUrl="/store"
                previousLabel={messages.previousPage}
                nextLabel={messages.nextPage}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-32 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{messages.emptyProductsTitle}</h3>
            <p className="text-slate-500 text-lg">{messages.emptyProductsSubtitle}</p>
          </div>
        )}
      </div>
      
      {/* Newsletter Section */}
      {isFirstPage && (
        <section className="bg-slate-900 py-24 mt-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Join our newsletter</h2>
            <p className="text-slate-400 mb-8 text-lg">Sign up for updates on new arrivals, special offers, and exclusive events.</p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="Email address" 
                className="flex-1 px-5 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
              <button 
                type="submit"
                className="px-8 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
