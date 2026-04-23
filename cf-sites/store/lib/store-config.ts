import { cacheKeys, cachedGet } from './cache';
import type { StoreEnv } from './cloudflare';

export interface StoreConfig {
  enabled: boolean;
  medusaSalesChannelId?: string;
  /** Publishable API Key (pk_...) for storefront; scoped to sales channel in Medusa. */
  medusaPublishableKey?: string;
  paymentMethods: {
    cod?: { enabled: boolean; label?: string };
    stripe?: { enabled: boolean; publishableKey?: string };
  };
  checkout?: {
    guestCheckout: boolean;
  };
  /** Homepage UI customizations */
  homepage?: {
    heroImage?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroButtonText?: string;
    heroButtonLink?: string;
    /** Whether to show a featured products section instead of just the product grid */
    featuredProductsTitle?: string;
  };
}

export interface StoreLookup {
  siteId?: string;
  hostname?: string;
}

export interface StoreConfigContext {
  config: StoreConfig;
  resolvedSiteId: string;
  cacheScope: string;
  language: string;
  hostname?: string;
}

const DEFAULT_CONFIG: StoreConfig = {
  enabled: true,
  paymentMethods: {
    cod: { enabled: true, label: 'Cash on Delivery' },
  },
  checkout: {
    guestCheckout: true,
  },
  homepage: {
    heroImage: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2000&auto=format&fit=crop',
    heroTitle: 'Premium Sports Gear',
    heroSubtitle: 'Elevate your game with our professional-grade equipment and apparel.',
    heroButtonText: 'Shop Collection',
    heroButtonLink: '#products',
    featuredProductsTitle: 'New Arrivals',
  }
};

const CACHE_TTL = 60; // Cache for 60 seconds

type HeaderReader = {
  get(name: string): string | null;
};

export function normalizeHostname(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.replace(/:\d+$/, '');
}

export function getLookupFromHeaders(headers: HeaderReader, siteId?: string): StoreLookup {
  const normalizedSiteId = siteId?.trim();
  if (normalizedSiteId) {
    return { siteId: normalizedSiteId };
  }

  const hostname = normalizeHostname(headers.get('x-forwarded-host') ?? headers.get('host'));
  return hostname ? { hostname } : {};
}

function getLookupCacheScope(lookup: StoreLookup): string {
  if (lookup.siteId) return `site:${lookup.siteId}`;
  if (lookup.hostname) return `host:${lookup.hostname}`;
  return 'default';
}

export function getDefaultStoreConfigContext(): StoreConfigContext {
  return {
    config: DEFAULT_CONFIG,
    resolvedSiteId: 'default',
    cacheScope: 'default',
    language: 'en',
  };
}

function getStoreSettingsUrl(cmsApiUrl: string, lookup: StoreLookup): string {
  const url = new URL('/api/settings/store', cmsApiUrl);
  if (lookup.siteId) {
    url.searchParams.set('siteId', lookup.siteId);
  } else if (lookup.hostname) {
    url.searchParams.set('domain', lookup.hostname);
  }
  return url.toString();
}

export async function fetchStoreConfig(
  env: Pick<StoreEnv, 'CACHE' | 'CMS_API_URL'>,
  lookup: StoreLookup,
): Promise<StoreConfigContext> {
  const initialScope = getLookupCacheScope(lookup);
  const fallbackSiteId = lookup.siteId || 'default';

  if (!env.CMS_API_URL) {
    return { ...getDefaultStoreConfigContext(), resolvedSiteId: fallbackSiteId, cacheScope: initialScope, hostname: lookup.hostname };
  }

  return cachedGet(
    env.CACHE,
    cacheKeys.config(initialScope),
    async () => {
      try {
        const res = await fetch(getStoreSettingsUrl(env.CMS_API_URL!, lookup));
        if (!res.ok) throw new Error('Failed to fetch config');

        const data = (await res.json()) as {
          store?: StoreConfig;
          resolvedSiteId?: string;
          language?: string;
        };

        const resolvedSiteId = data.resolvedSiteId || fallbackSiteId;
        return {
          config: data.store || DEFAULT_CONFIG,
          resolvedSiteId,
          cacheScope: `site:${resolvedSiteId}`,
          language: data.language || 'en',
          hostname: lookup.hostname,
        };
      } catch (e) {
        console.error('Error fetching store config:', e);
        return {
          ...getDefaultStoreConfigContext(),
          resolvedSiteId: fallbackSiteId,
          cacheScope: initialScope,
          hostname: lookup.hostname,
        };
      }
    },
    { ttl: CACHE_TTL },
  );
}
