import { cachedGet, cacheKeys } from './cache';
import type { StoreEnv } from './cloudflare';
import type Medusa from '@medusajs/js-sdk';
import { resolveStoreLanguage } from './i18n';

interface StoreRegion {
  id: string;
  name: string;
  currency_code: string;
  countries?: Array<{ iso_2: string }>;
}

export interface PricingContext {
  regionId?: string;
  countryCode?: string;
  currencyCode?: string;
}

const preferredCountryByLanguage: Record<string, string> = {
  'zh-CN': 'cn',
  zh: 'cn',
  en: 'gb',
  id: 'id',
  ja: 'jp',
  ko: 'kr',
  vi: 'vn',
  'vi-VN': 'vn',
  th: 'th',
  'th-TH': 'th',
};

const preferredCurrencyByLanguage: Record<string, string> = {
  'zh-CN': 'cny',
  zh: 'cny',
  en: 'usd',
  id: 'idr',
  ja: 'jpy',
  ko: 'krw',
  vi: 'vnd',
  'vi-VN': 'vnd',
  th: 'thb',
  'th-TH': 'thb',
};

async function listStoreRegions(env: Pick<StoreEnv, 'CACHE'>, medusa: InstanceType<typeof Medusa>) {
  if (!env.CACHE) {
    try {
      const { regions } = await medusa.store.region.list({
        fields: 'id,name,currency_code,*countries',
      } as any);
      return regions || [];
    } catch {
      return [];
    }
  }

  return cachedGet(
    env.CACHE,
    cacheKeys.regions(),
    async () => {
      const { regions } = await medusa.store.region.list({
        fields: 'id,name,currency_code,*countries',
      } as any);
      return regions || [];
    },
    { ttl: 300 },
  ) as Promise<StoreRegion[]>;
}

export async function getPricingContext(
  env: Pick<StoreEnv, 'CACHE'>,
  medusa: InstanceType<typeof Medusa>,
  language?: string | null,
): Promise<PricingContext> {
  const normalizedLanguage = resolveStoreLanguage(language);
  const preferredCountry = preferredCountryByLanguage[normalizedLanguage];
  const preferredCurrency = preferredCurrencyByLanguage[normalizedLanguage];
  const regions = await listStoreRegions(env, medusa);

  const byCountry = preferredCountry
    ? regions.find((region) => region.countries?.some((country) => country.iso_2 === preferredCountry))
    : undefined;

  const byCurrency = preferredCurrency
    ? regions.find((region) => region.currency_code === preferredCurrency)
    : undefined;

  const region = byCountry || byCurrency || regions[0];
  if (!region) return {};

  const countryCode =
    region.countries?.find((country) => country.iso_2 === preferredCountry)?.iso_2 ||
    region.countries?.[0]?.iso_2;

  return {
    regionId: region.id,
    countryCode,
    currencyCode: region.currency_code,
  };
}
